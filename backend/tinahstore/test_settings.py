"""Isolated checkout tests: never connect to the configured application database."""
from .settings import *

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']
SECURE_SSL_REDIRECT = False
TELEGRAM_BOT_TOKEN = ''
TELEGRAM_CHAT_IDS = []
MPESA_CONSUMER_KEY = ''
MPESA_CONSUMER_SECRET = ''
MPESA_SHORTCODE = ''
MPESA_PASSKEY = ''
MPESA_CALLBACK_URL = ''
