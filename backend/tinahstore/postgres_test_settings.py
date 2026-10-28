"""Only used by scripts/check_checkout_postgres.py's disposable loopback cluster."""
from .test_settings import *

_qa_port = os.environ.get('SEEDLINGS_QA_POSTGRES_PORT')
if not _qa_port or not _qa_port.isdigit() or not 1024 <= int(_qa_port) <= 65535:
    raise RuntimeError('Start PostgreSQL checks through scripts/check_checkout_postgres.py.')
DATABASES = {'default': {
    'ENGINE': 'django.db.backends.postgresql', 'NAME': 'postgres',
    'USER': 'seedlings_qa', 'PASSWORD': '', 'HOST': '127.0.0.1', 'PORT': _qa_port,
    'CONN_MAX_AGE': 0, 'TEST': {'NAME': 'test_seedlings_checkout'},
}}
