"""
Today's weather for the city on the account, turned into advice about what to
wear.

Two calls are made to OpenWeather and cached together: the current reading, and
the next few forecast steps for the day's high, low and chance of rain. The free
plan allows sixty calls a minute, and an uncached dashboard would spend one on
every load.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"
FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"

# Eight three-hour steps is the next twenty-four hours.
FORECAST_STEPS = 8


class WeatherUnavailable(Exception):
    """Carries a sentence that can be shown to the reader unchanged."""

    def __init__(self, reason: str, code: str):
        super().__init__(reason)
        self.reason = reason
        self.code = code


@dataclass(frozen=True)
class Advice:
    headline: str
    wear: str
    warmth_levels: list[int]
    season: str
    take_umbrella: bool


@dataclass(frozen=True)
class Weather:
    city: str
    country: str
    temp_c: int
    feels_like_c: int
    high_c: int
    low_c: int
    humidity: int
    wind_kph: int
    condition: str
    description: str
    icon: str
    is_day: bool
    rain_chance: int
    advice: Advice

    def as_dict(self) -> dict:
        return asdict(self)


# Read against how it feels rather than the thermometer: 30 degrees in still,
# humid air is dressed for differently from 30 in a breeze. Each band names the
# warmth_level values on a garment that suit it.
BANDS = [
    (8, "Cold", "Something heavy, and a layer underneath.", [4, 5], "WINTER"),
    (16, "Chilly", "A jacket or a shawl over what you are wearing.", [3, 4], "WINTER"),
    (23, "Mild", "Light layers. Easy to take one off if it warms up.", [2, 3], "SPRING"),
    (31, "Warm", "Light clothes are enough.", [1, 2], "SUMMER"),
    (999, "Very hot", "The lightest and loosest you own. Stay out of the sun.", [1], "SUMMER"),
]

WET = {"Rain", "Drizzle", "Thunderstorm", "Snow"}


def advise(feels_like: float, condition: str, rain_chance: int) -> Advice:
    for ceiling, headline, wear, levels, season in BANDS:
        if feels_like < ceiling:
            break

    umbrella = condition in WET or rain_chance >= 40
    if umbrella:
        wear = f"{wear} Rain is likely, so take something that keeps water out."

    return Advice(
        headline=headline,
        wear=wear,
        warmth_levels=levels,
        season=season,
        take_umbrella=umbrella,
    )


def _place(city: str, country_code: str) -> str:
    city = (city or "").strip()
    country_code = (country_code or "").strip().upper()
    return f"{city},{country_code}" if country_code else city


def _get(url: str, params: dict) -> dict:
    response = requests.get(url, params=params, timeout=settings.WEATHER_TIMEOUT_SECONDS)
    if response.status_code == 404:
        raise WeatherUnavailable(
            "That city was not found. Check the spelling, or try the nearest larger city.",
            "unknown_city",
        )
    if response.status_code in (401, 403):
        logger.error("OpenWeather rejected the key: %s", response.status_code)
        raise WeatherUnavailable("The weather service is not set up yet.", "not_configured")
    if response.status_code == 429:
        raise WeatherUnavailable("The weather service is busy. Try again shortly.", "rate_limited")
    response.raise_for_status()
    return response.json()


def _round(value) -> int:
    return int(round(float(value)))


def for_city(city: str, country_code: str = "") -> Weather:
    """
    Raises WeatherUnavailable with a readable reason rather than returning a
    half-filled reading, so the screen never shows a temperature it invented.
    """
    if not settings.OPENWEATHER_API_KEY:
        raise WeatherUnavailable("The weather service is not set up yet.", "not_configured")

    place = _place(city, country_code)
    if not place:
        raise WeatherUnavailable(
            "Tell us your city and the weather can be shown here.", "no_city"
        )

    key = f"weather:{place.lower()}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    params = {"q": place, "appid": settings.OPENWEATHER_API_KEY, "units": "metric"}
    try:
        now = _get(CURRENT_URL, params)
        soon = _get(FORECAST_URL, {**params, "cnt": FORECAST_STEPS})
    except WeatherUnavailable:
        raise
    except requests.Timeout as exc:
        raise WeatherUnavailable("The weather service did not answer in time.", "timeout") from exc
    except requests.RequestException as exc:
        logger.warning("Weather lookup failed for %s: %s", place, exc)
        raise WeatherUnavailable("The weather could not be fetched just now.", "unreachable") from exc

    steps = soon.get("list", [])
    temps = [step["main"]["temp"] for step in steps] or [now["main"]["temp"]]
    rain_chance = max((step.get("pop", 0) for step in steps), default=0)

    sky = (now.get("weather") or [{}])[0]
    sun = now.get("sys", {})
    stamp = now.get("dt", 0)

    reading = Weather(
        city=now.get("name") or city,
        country=sun.get("country", country_code.upper()),
        temp_c=_round(now["main"]["temp"]),
        feels_like_c=_round(now["main"]["feels_like"]),
        high_c=_round(max(temps)),
        low_c=_round(min(temps)),
        humidity=_round(now["main"].get("humidity", 0)),
        # OpenWeather reports metres per second, which almost nobody reads.
        wind_kph=_round(now.get("wind", {}).get("speed", 0) * 3.6),
        condition=sky.get("main", ""),
        description=sky.get("description", ""),
        icon=sky.get("icon", ""),
        is_day=bool(sun.get("sunrise", 0) <= stamp <= sun.get("sunset", 0)),
        rain_chance=_round(rain_chance * 100),
        advice=advise(now["main"]["feels_like"], sky.get("main", ""), _round(rain_chance * 100)),
    )

    cache.set(key, reading, settings.WEATHER_CACHE_SECONDS)
    return reading
