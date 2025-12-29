"""
Django settings for VERP project.
"""

from pathlib import Path
import os
from datetime import timedelta
from decouple import config, Csv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
# Read SECRET_KEY from environment or .env file
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-this-in-production-!@#$%^&*()')

# DEBUG should be disabled in production. Control via DJANGO_DEBUG env var.
# Default to True for local development unless explicitly set to 'False'.
DEBUG = config('DJANGO_DEBUG', default=True, cast=bool)

# ALLOWED_HOSTS can be provided via comma-separated env var, default to localhost
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    
    # VERP apps
    'users',
    'suppliers',
    'customers',
    'orders',
    'customer_orders',
    'core',
    'verp_settings',
    'company',
    'sales',
    'inventory',
    'projects',
    'systems',
    'manufacturing',
    'visiview',
    'service',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'verp.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'verp.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'verp_db'),
        'USER': os.environ.get('POSTGRES_USER', 'verp_user'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'verp_password'),
        'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'de-de'
TIME_ZONE = 'Europe/Berlin'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files (uploads) - Externer Speicherort aus .env
# Der Pfad kann absolut sein (z.B. C:/VERP-Media oder /var/verp-media)
MEDIA_URL = '/media/'
_media_root_env = config('MEDIA_ROOT', default='')
if _media_root_env:
    MEDIA_ROOT = Path(_media_root_env)
else:
    MEDIA_ROOT = BASE_DIR / 'media'

# Ensure MEDIA_ROOT directory exists
if not MEDIA_ROOT.exists():
    try:
        MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
        print(f"Created MEDIA_ROOT directory: {MEDIA_ROOT}")
    except Exception as e:
        print(f"Warning: Could not create MEDIA_ROOT directory {MEDIA_ROOT}: {e}")

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'verp.authentication.JWTCookieAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

CORS_ALLOW_CREDENTIALS = True

# In local development we may get preflight requests redirected (301)
# due to APPEND_SLASH/URL normalization; disable automatic append-slash
# and relax CORS to allow the frontend dev server access.
APPEND_SLASH = False

# Allow all origins when DEBUG to avoid CORS blocking during local development.
# This is intentionally permissive and should NOT be used in production.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    # In production, rely on explicit CORS_ALLOWED_ORIGINS above
    CORS_ALLOW_ALL_ORIGINS = False

# Security-related settings (sane defaults; override via environment variables)
if DEBUG:
    # In development we do NOT enforce HTTPS redirects or secure-only cookies
    SECURE_HSTS_SECONDS = 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
else:
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'True') == 'True'
    SECURE_HSTS_PRELOAD = os.environ.get('SECURE_HSTS_PRELOAD', 'True') == 'True'
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True') == 'True'
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'True') == 'True'
    CSRF_COOKIE_SECURE = os.environ.get('CSRF_COOKIE_SECURE', 'True') == 'True'
