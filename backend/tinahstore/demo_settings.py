"""Opt-in, local-only nursery preview. Never uses the configured database or R2."""
from .settings import *

LOCAL_DEMO_MODE = True
LOCAL_DEMO_ROOT = BASE_DIR / '.local-demo'
LOCAL_DEMO_ROOT.mkdir(exist_ok=True)
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]']
DATABASES = {'default': {
    'ENGINE': 'django.db.backends.sqlite3',
    'NAME': LOCAL_DEMO_ROOT / 'db.sqlite3',
}}
MEDIA_ROOT = LOCAL_DEMO_ROOT / 'media'
MEDIA_URL = '/media/'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
TELEGRAM_BOT_TOKEN = ''
TELEGRAM_CHAT_IDS = []
MPESA_CONSUMER_KEY = ''
MPESA_CONSUMER_SECRET = ''
MPESA_SHORTCODE = ''
MPESA_PASSKEY = ''
MPESA_CALLBACK_URL = ''
GOOGLE_OAUTH_CLIENT_ID = ''
GOOGLE_OAUTH_CLIENT_SECRET = ''
SOCIALACCOUNT_PROVIDERS = {}
R2_ACCESS_KEY_ID = ''
