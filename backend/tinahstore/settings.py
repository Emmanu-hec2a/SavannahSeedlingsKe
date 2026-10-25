import os
from pathlib import Path
import environ
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    DEPOSIT_PERCENTAGE=(float, 0.60),
    DELIVERY_FEE=(int, 250),
    FREE_DELIVERY_THRESHOLD=(int, 5000),
)

environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# ── Core ──────────────────────────────────────────────────────────────────────

SECRET_KEY = env('SECRET_KEY')
DEBUG       = env('DEBUG')

ALLOWED_HOSTS = env.list(
    'ALLOWED_HOSTS',
    default=['localhost', '127.0.0.1']
)

# settings.py

CSRF_TRUSTED_ORIGINS = [
    "https://api.tinahstore.store",
    "https://tinahstore.store",  # Good practice to include your frontend too
]


# ── Applications ──────────────────────────────────────────────────────────────

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.sites',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',


    # Third-party
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'dj_rest_auth',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',

    # Local
    'products',
    'orders',
    'payments',
    'core',
]

# ── Middleware ────────────────────────────────────────────────────────────────

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',          # must be first
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    # CSRF disabled — API uses Token auth, not session cookies
    # 'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'tinahstore.urls'

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

WSGI_APPLICATION = 'tinahstore.wsgi.application'

# ── Database ──────────────────────────────────────────────────────────────────

import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL'),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# ── Cache ─────────────────────────────────────────────────────────────────────

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'tinahstore-cache',
    }
}

# Allow guests to reopen only their own saved order across storefront/API origins.
CORS_ALLOW_HEADERS = (*default_headers, 'x-order-token')

# ── Password validation ───────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── Internationalisation ──────────────────────────────────────────────────────

LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'Africa/Nairobi'
USE_I18N      = True
USE_TZ        = True

# ── Static files ──────────────────────────────────────────────────────────────

STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
# Note: STATICFILES_STORAGE is configured via STORAGES["staticfiles"] below

# ── Media files ───────────────────────────────────────────────────────────────
# R2 configuration using django-storages (S3Boto3Storage)
# Falls back to local media storage in development if R2 isn't configured.

R2_ACCESS_KEY_ID = env('R2_ACCESS_KEY_ID', default='')

if R2_ACCESS_KEY_ID:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "access_key": R2_ACCESS_KEY_ID,
                "secret_key": env('R2_SECRET_ACCESS_KEY'),
                "bucket_name": env('R2_BUCKET_NAME'),
                "endpoint_url": env('R2_ENDPOINT_URL'),
                "custom_domain": env('R2_PUBLIC_URL', default='').replace('https://', '').replace('http://', '').strip('/'),
                "file_overwrite": False,
                "default_acl": "public-read",
                "querystring_auth": False,
                "verify": True,
            },
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
    
    # Still set MEDIA_URL based on custom domain
    custom_domain = STORAGES["default"]["OPTIONS"]["custom_domain"]
    MEDIA_URL = f"https://{custom_domain}/" if custom_domain else "/media/"
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'

# ── DRF ──────────────────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.authentication.AdminSessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 12,
    'DEFAULT_THROTTLE_RATES': {'admin_login': '10/min'},
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        *(['rest_framework.renderers.BrowsableAPIRenderer'] if DEBUG else []),
    ],
}

# ── CORS ──────────────────────────────────────────────────────────────────────

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = env.list(
        'CORS_ALLOWED_ORIGINS',
        default=[
            'https://tinahstore.co.ke',
            'https://www.tinahstore.co.ke',
            'https://tinahstore.pages.dev',
            'https://tinahstore.store',
            'https://admin.tinahstore.store',
            'https://admin-tinahstore.pages.dev',
        ]
    )
if DEBUG:
    CORS_ALLOWED_ORIGINS = list(dict.fromkeys([
        *CORS_ALLOWED_ORIGINS,
        *[f'http://{host}:{port}' for host in ('localhost', '127.0.0.1') for port in (5173, 5174, 4173, 4174)],
    ]))

CORS_ALLOW_CREDENTIALS = True
ADMIN_SESSION_TTL_SECONDS = env.int('ADMIN_SESSION_TTL_SECONDS', default=28800)

# ── Security headers (production only) ───────────────────────────────────────

if not DEBUG:
    SECURE_PROXY_SSL_HEADER        = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT            = True
    SESSION_COOKIE_SECURE          = True
    CSRF_COOKIE_SECURE             = True
    SECURE_HSTS_SECONDS            = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD            = True
    SECURE_CONTENT_TYPE_NOSNIFF    = True

# ── Business logic ────────────────────────────────────────────────────────────

DEPOSIT_PERCENTAGE      = env.float('DEPOSIT_PERCENTAGE', default=1.0)
DELIVERY_FEE            = env.float('DELIVERY_FEE', default=0.0)
FREE_DELIVERY_THRESHOLD = env.float('FREE_DELIVERY_THRESHOLD', default=0.0)

# ── M-PESA Daraja ─────────────────────────────────────────────────────────────

MPESA_CONSUMER_KEY    = env('MPESA_CONSUMER_KEY', default='')
MPESA_CONSUMER_SECRET = env('MPESA_CONSUMER_SECRET', default='')
MPESA_SHORTCODE       = env('MPESA_SHORTCODE', default='')
MPESA_PASSKEY         = env('MPESA_PASSKEY', default='')
MPESA_CALLBACK_URL    = env('MPESA_CALLBACK_URL', default='')
MPESA_ENV             = env('MPESA_ENV', default='sandbox')

# ── Telegram alerts ───────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = env('TELEGRAM_BOT_TOKEN', default='')
TELEGRAM_CHAT_IDS  = env.list('TELEGRAM_CHAT_IDS', default=[])

# ── Google OAuth / allauth ────────────────────────────────────────────────────

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

SITE_ID = 1

ACCOUNT_EMAIL_VERIFICATION = 'none'
ACCOUNT_LOGIN_METHODS = {'email'}
ACCOUNT_SIGNUP_FIELDS = ['email*', 'password1*', 'password2*']
ACCOUNT_USER_MODEL_USERNAME_FIELD = None

GOOGLE_OAUTH_CLIENT_ID     = env('GOOGLE_OAUTH_CLIENT_ID',     default='')
GOOGLE_OAUTH_CLIENT_SECRET = env('GOOGLE_OAUTH_CLIENT_SECRET', default='')
GOOGLE_OAUTH_CALLBACK_URL  = env(
    'GOOGLE_OAUTH_CALLBACK_URL',
    default='http://localhost:5173/auth/callback/'
)

REST_AUTH = {
    'SESSION_LOGIN': False,
    'TOKEN_MODEL': 'rest_framework.authtoken.models.Token',
    'REGISTER_SERIALIZER': 'core.serializers.CustomRegisterSerializer',  # ← fix this
}
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'APP': {
            'client_id': GOOGLE_OAUTH_CLIENT_ID,
            'secret':    GOOGLE_OAUTH_CLIENT_SECRET,
            'key':       ''
        },
        'SCOPE':       ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
        'CALLBACK_URL': GOOGLE_OAUTH_CALLBACK_URL,
    }
}

SOCIALACCOUNT_STORE_TOKENS = True
SOCIALACCOUNT_AUTO_SIGNUP = True       # ← auto-create account on first Google login
SOCIALACCOUNT_EMAIL_REQUIRED = False   # ← don't block on missing email


# ── Misc ──────────────────────────────────────────────────────────────────────

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
