"""Run stock locking checks on an owned temporary PostgreSQL cluster, never DATABASE_URL."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory, gettempdir


def main():
    initdb = shutil.which('initdb')
    pg_ctl = shutil.which('pg_ctl')
    if not initdb or not pg_ctl:
        raise SystemExit('Install PostgreSQL server binaries and put initdb/pg_ctl on PATH first.')
    if shutil.disk_usage(gettempdir()).free < 200 * 1024 * 1024:
        raise SystemExit('Free at least 200 MB on the temporary drive before running disposable PostgreSQL checks.')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    environment = dict(os.environ, SEEDLINGS_QA_POSTGRES_PORT=str(port))
    environment.pop('RUN_ADMIN_BROWSER_TESTS', None)
    root = Path(__file__).resolve().parents[1]
    with TemporaryDirectory(prefix='seedlings-checkout-postgres-') as directory:
        owned = Path(directory).resolve()
        data = owned / 'data'
        started = False
        try:
            subprocess.run([initdb, '-D', str(data), '-U', 'seedlings_qa', '--auth=trust',
                            '--encoding=UTF8', '--locale=C'], check=True, timeout=45)
            subprocess.run([pg_ctl, '-D', str(data), '-l', str(owned / 'server.log'),
                            '-o', f'-h 127.0.0.1 -p {port} -F -c max_connections=20',
                            '-w', '-t', '25', 'start'], check=True, timeout=35)
            started = True
            return subprocess.run([
                sys.executable, '-B', 'manage.py', 'test',
                'orders.test_inventory', 'orders.tests', 'core.test_customer_auth',
                '--settings=tinahstore.postgres_test_settings', '--noinput',
            ], cwd=root, env=environment, timeout=120).returncode
        finally:
            if started:
                subprocess.run([pg_ctl, '-D', str(data), '-m', 'fast', '-w', '-t', '25', 'stop'],
                               check=True, timeout=35)
            # TemporaryDirectory only removes this owned, resolved QA directory.


if __name__ == '__main__':
    raise SystemExit(main())
