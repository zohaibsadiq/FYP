"""
Django settings for the Smart Wardrobe project.

RULE: no secret is ever written in this file. Everything sensitive is read from
a `.env` file that is NOT committed to git. See `.env.example` for the template.
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Read the .env file
# ---------------------------------------------------------------------------
env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3000"]),
    DATABASE_URL=(str, ""),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="dev-only-insecure-key-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
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
    "rest_framework",                 # the API toolkit
    "rest_framework_simplejwt",       # login tokens
    "corsheaders",                    # lets localhost:3000 call localhost:8000
    "django_filters",                 # ?category=shirt&color=blue filtering
    "drf_spectacular",                # auto-generated API documentation page
]

# Our own feature apps. One folder per feature, so you and your teammate never
# edit the same file.
LOCAL_APPS = [
    "apps.accounts",      # users, login, profile
    "apps.wardrobe",      # clothing items, categories, storage locations
    "apps.outfits",       # saved outfits, wear log
    "apps.planner",       # events, calendar, weather
    "apps.intelligence",  # outfit suggestion engine, colour rules
    "apps.vision",        # background removal, Fashion-CLIP, virtual try-on
    "apps.community",     # marketplace + friend swapping
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",          # must be near the top
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",     # serves static files in production
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

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
# Paste your Neon connection string into .env as DATABASE_URL.
# If it is empty we fall back to a local SQLite file so the project still runs.
if env("DATABASE_URL"):
    DATABASES = {"default": env.db_url("DATABASE_URL")}
    DATABASES["default"]["CONN_MAX_AGE"] = 600               # reuse connections
    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"]["sslmode"] = "require"   # Neon requires SSL
else:
    print("\n*** WARNING: DATABASE_URL is empty -> using local SQLite ***\n")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"       # points at OUR user model, not Django's

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    # Every endpoint requires a logged-in user unless it explicitly opts out
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # How we identify the user: a JWT token in the Authorization header
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    # Long lists come back in pages of 24 (fits a 4x6 closet grid nicely)
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 24,
    # Enables ?category=shirt&search=denim&ordering=-created_at on list endpoints
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),   # sent on every request
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),      # used to get a new access token
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ---------------------------------------------------------------------------
# API documentation (visit /api/docs/ in the browser)
# ---------------------------------------------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "Smart Wardrobe API",
    "DESCRIPTION": (
        "Context-Aware Smart Wardrobe Management System with Generative "
        "Virtual Try-On and Recency Analytics."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# ---------------------------------------------------------------------------
# CORS - which frontend URLs are allowed to call this API
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = env("TIME_ZONE", default="Asia/Karachi")
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static and media files
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Cloudinary - where all garment and try-on images live
# ---------------------------------------------------------------------------
# Why not just store images on the server's disk? Because Render's free tier
# has an "ephemeral" filesystem: every time the app restarts or redeploys, any
# uploaded files are wiped. Cloudinary keeps them permanently, serves them from
# a CDN, and can resize them on the fly via the URL.
CLOUDINARY = {
    "cloud_name": env("CLOUDINARY_CLOUD_NAME", default=""),
    "api_key": env("CLOUDINARY_API_KEY", default=""),
    "api_secret": env("CLOUDINARY_API_SECRET", default=""),
}

# The folder inside Cloudinary that everything from this project goes into,
# so your account stays tidy if you ever build something else.
CLOUDINARY_ROOT_FOLDER = env("CLOUDINARY_ROOT_FOLDER", default="lumiere")
