"""Isolated application tests: never connect to the configured application database."""
import os
from pathlib import Path
from tempfile import TemporaryDirectory

from .settings import *

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
if os.environ.get('RUN_ADMIN_BROWSER_TESTS') == '1':
    # Parallel browser requests need independent SQLite connections. Sharing one
    # in-memory connection across the live-server threads can corrupt a test's
    # transaction boundaries. This disposable file never uses the real database.
    _browser_database = TemporaryDirectory(prefix='seedlings-admin-qa-')
    DATABASES['default']['TEST'] = {'NAME': str(Path(_browser_database.name) / 'test.sqlite3')}
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
# Never inherit a real CDN/R2 media origin in isolated upload/browser checks.
MEDIA_URL = '/media/'
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
