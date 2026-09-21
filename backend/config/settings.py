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
# reach a deployed environment, where a predictable key means forgeable tokens.
SECRET_KEY = env("SECRET_KEY", default="insecure-development-key")
if not DEBUG and SECRET_KEY == "insecure-development-key":
    raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG is off.")

ALLOWED_HOSTS = env("ALLOWED_HOSTS")

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",   # ArrayField, full-text search helpers
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",                 # query-param filtering on list endpoints
    "drf_spectacular",                # OpenAPI schema generation
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.wardrobe",
    "apps.outfits",
    "apps.planner",
    "apps.shopping",
    "apps.intelligence",
    "apps.vision",
    "apps.community",
    "apps.circle",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",          # must stay above CommonMiddleware
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

# Every real environment sets DATABASE_URL. The SQLite branch exists so manage.py
# works without credentials, but it carries less than the full schema:
# wardrobe.Item keeps seasons and occasions in a Postgres ArrayField.
if env("DATABASE_URL"):
    DATABASES = {"default": env.db_url("DATABASE_URL")}

    # Neon suspends an idle compute after 300s, so a connection held longer than
    # that is dead on next use. The health check costs one round trip and only
    # when the connection is actually reused.
    DATABASES["default"]["CONN_MAX_AGE"] = env.int("CONN_MAX_AGE", default=120)
    DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"]["sslmode"] = "require"   # Neon refuses plaintext connections

    # The -pooler host is PgBouncer in transaction mode, where server-side
    # cursors do not survive between statements. QuerySet.iterator() uses them.
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

AUTH_USER_MODEL = "accounts.User"       # email is the login field, not username

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
    "PAGE_SIZE": 24,   # divides evenly across the 2, 3 and 4 column wardrobe grids
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Closette API",
    "DESCRIPTION": "Wardrobe items, storage locations, outfits and planning data for Closette.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    # Two models both call their field "status", and left alone the generator
    # settles the clash by hashing: "Status74aEnum". Anyone generating a client
    # from this schema would get that name, and it would change the moment a
    # third status appeared. Naming them here keeps the schema readable and
    # stable.
    "ENUM_NAME_OVERRIDES": {
        "GarmentStatusEnum": "apps.wardrobe.models.GarmentItem.Status",
        "ListingStatusEnum": "apps.community.models.Listing.Status",
    },
}

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

# Garment and try-on images live in Cloudinary because the app host wipes its
# filesystem on every deploy.
CLOUDINARY = {
    "cloud_name": env("CLOUDINARY_CLOUD_NAME", default=""),
    "api_key": env("CLOUDINARY_API_KEY", default=""),
    "api_secret": env("CLOUDINARY_API_SECRET", default=""),
}

CLOUDINARY_ROOT_FOLDER = env("CLOUDINARY_ROOT_FOLDER", default="closette")

# Weather is read for the city on the account. The forecast is cached rather
# than fetched per request: the free plan allows 60 calls a minute and every
# dashboard load would otherwise be one.
OPENWEATHER_API_KEY = env("OPENWEATHER_API_KEY", default="")
WEATHER_CACHE_SECONDS = env.int("WEATHER_CACHE_SECONDS", default=1800)
WEATHER_TIMEOUT_SECONDS = env.float("WEATHER_TIMEOUT_SECONDS", default=6.0)
