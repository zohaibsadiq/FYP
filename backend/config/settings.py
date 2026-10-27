from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3000"]),
    DATABASE_URL=(str, ""),
)
environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env("DEBUG")

# The fallback exists so a fresh checkout runs without a .env. It must never
# reach a real server: a key anybody can read means anybody can forge a login.
SECRET_KEY = env("SECRET_KEY", default="insecure-development-key")
if not DEBUG and SECRET_KEY == "insecure-development-key":
    raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG is off.")

ALLOWED_HOSTS = env("ALLOWED_HOSTS")

if not DEBUG:
    # Render handles HTTPS at its front door and passes plain HTTP on to Django.
    # Django has to be told which header says "this really was HTTPS", or the
    # redirect below sends every request round in a loop forever.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    # Render checks the service is alive by calling this address over plain
    # HTTP. A redirect answer would count as "unhealthy" and fail the deploy.
    SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]

    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

# A garment photo from a modern phone is 3 to 8 MB. Twenty leaves room for
# the wrapping around an upload, while still refusing a request built to use
# up the server's memory.
DATA_UPLOAD_MAX_MEMORY_SIZE = env.int("DATA_UPLOAD_MAX_MEMORY_SIZE", default=20 * 1024 * 1024)
FILE_UPLOAD_MAX_MEMORY_SIZE = DATA_UPLOAD_MAX_MEMORY_SIZE
DATA_UPLOAD_MAX_NUMBER_FIELDS = 200

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "rest_framework_simplejwt.token_blacklist",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.wardrobe",
    "apps.planner",
    "apps.shopping",
    "apps.intelligence",
    "apps.vision",
    "apps.community",
    "apps.circle",
    "apps.tryon",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # must stay above CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Every real environment sets DATABASE_URL. The SQLite fallback exists so
# manage.py runs without any credentials, but it cannot hold the full schema:
# a garment's seasons and occasions are stored as Postgres lists.
if env("DATABASE_URL"):
    DATABASES = {"default": env.db_url("DATABASE_URL")}

    # Neon puts an idle database to sleep after 300 seconds, so a connection
    # kept open longer than that is dead the next time it is used. The health
    # check costs one quick round trip, and only when a connection is reused.
    DATABASES["default"]["CONN_MAX_AGE"] = env.int("CONN_MAX_AGE", default=120)
    DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"]["sslmode"] = "require"  # Neon refuses unencrypted connections

    # The "-pooler" address shares connections between statements, so a
    # database cursor does not survive from one statement to the next.
    # Django's iterator() relies on cursors, so it is told not to use them.
    if "-pooler" in env("DATABASE_URL"):
        DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True
elif DEBUG:
    print("WARNING: DATABASE_URL is not set, using local SQLite")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    raise ImproperlyConfigured(
        "DATABASE_URL is required when DEBUG is off. Refusing to start against "
        "an empty local SQLite file."
    )

AUTH_USER_MODEL = "accounts.User"  # email is the login field, not username

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "config.pagination.StandardPagination",
    "PAGE_SIZE": 24,  # divides evenly into the 2, 3 and 4 column closet grids
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Exactly one proxy (Render's) sits in front of this service. Left unset,
    # the rate limiter would identify a caller by a header the caller can
    # write themselves, and so change on every request to dodge the limit.
    "NUM_PROXIES": env.int("NUM_PROXIES", default=None if DEBUG else 1),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="2000/hour" if DEBUG else "120/hour"),
        "user": env("THROTTLE_USER", default="20000/hour" if DEBUG else "2000/hour"),
        # Guessing a password, an email, or an eight-character friend code all
        # look like ordinary traffic one request at a time. These limits are
        # what make the thousandth guess impossible.
        "login": env("THROTTLE_LOGIN", default="2000/hour" if DEBUG else "10/min"),
        "signup": env("THROTTLE_SIGNUP", default="2000/hour" if DEBUG else "10/hour"),
        "friend-code": env("THROTTLE_FRIEND_CODE", default="2000/hour" if DEBUG else "20/hour"),
        "body-photo": env("THROTTLE_BODY_PHOTO", default="2000/hour" if DEBUG else "12/hour"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    # Every refresh hands out a new refresh token. Without this, the old one
    # would stay valid for its full seven days, so a stolen one would survive
    # the very step meant to retire it.
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "My Closette API",
    "DESCRIPTION": "Wardrobe items, storage locations, outfits and planning data for My Closette.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    # Two models both have a field called "status". Left alone, the docs
    # generator tells them apart with a random-looking name such as
    # "Status74aEnum", which would also change the moment a third status
    # appeared. Naming them here keeps the API docs readable and stable.
    "ENUM_NAME_OVERRIDES": {
        "GarmentStatusEnum": "apps.wardrobe.models.GarmentItem.Status",
        "ListingStatusEnum": "apps.community.models.Listing.Status",
    },
}

# Virtual try-on. The picture is made on the supplier's hardware, so the only
# cost here is money per picture, and TRYON_DAILY_LIMIT is what caps it.
TRYON_API_KEY = env("TRYON_API_KEY", default="")
TRYON_DAILY_LIMIT = env.int("TRYON_DAILY_LIMIT", default=10)

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("TIME_ZONE", default="Asia/Karachi")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Garment and try-on pictures live in Cloudinary because the app host wipes
# its own disk on every deploy.
CLOUDINARY = {
    "cloud_name": env("CLOUDINARY_CLOUD_NAME", default=""),
    "api_key": env("CLOUDINARY_API_KEY", default=""),
    "api_secret": env("CLOUDINARY_API_SECRET", default=""),
}

CLOUDINARY_ROOT_FOLDER = env("CLOUDINARY_ROOT_FOLDER", default="closette")

# Weather is read for the city on the account and remembered for half an
# hour. The free plan allows 60 requests a minute, and every visit to the home
# page would otherwise spend one.
OPENWEATHER_API_KEY = env("OPENWEATHER_API_KEY", default="")
WEATHER_CACHE_SECONDS = env.int("WEATHER_CACHE_SECONDS", default=1800)
WEATHER_TIMEOUT_SECONDS = env.float("WEATHER_TIMEOUT_SECONDS", default=6.0)
