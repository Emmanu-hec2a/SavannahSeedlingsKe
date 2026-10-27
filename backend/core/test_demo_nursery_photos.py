from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from .management.commands.seed_demo_nursery_photos import Command
from .models import NurseryPhoto


class DemoNurseryPhotoTests(TestCase):
    def test_normal_settings_refuse_demo_writes(self):
        with self.assertRaisesMessage(CommandError, 'demo_settings'):
            call_command('seed_demo_nursery_photos', stdout=StringIO())
        self.assertFalse(NurseryPhoto.objects.exists())

    @override_settings(DEBUG=True, LOCAL_DEMO_MODE=True)
    def test_wrong_database_path_is_rejected(self):
        with self.assertRaisesMessage(CommandError, 'demo_settings'):
            Command().validate_environment()
        self.assertFalse(NurseryPhoto.objects.exists())

    def test_seed_creates_three_local_photos_and_preserves_existing_edits_on_repeat(self):
        with TemporaryDirectory(prefix='seedlings-demo-test-') as directory:
            storage = FileSystemStorage(location=directory, base_url='/media/')
            with patch.object(Command, 'validate_environment', return_value=storage):
                call_command('seed_demo_nursery_photos', stdout=StringIO())
                self.assertEqual(NurseryPhoto.objects.count(), 3)
                self.assertEqual(NurseryPhoto.objects.filter(is_featured=True).count(), 1)
                self.assertTrue(all(photo.caption.startswith('Demo -') for photo in NurseryPhoto.objects.all()))
                first = NurseryPhoto.objects.first()
                first.caption, first.is_active = 'Edited demo caption', False
                first.save()
                call_command('seed_demo_nursery_photos', stdout=StringIO())
                first.refresh_from_db()
                self.assertEqual(first.caption, 'Edited demo caption')
                self.assertFalse(first.is_active)
                self.assertEqual(NurseryPhoto.objects.count(), 3)
                self.assertEqual(len(list(Path(directory).rglob('*.jpg'))), 3)

    def test_partial_failure_rolls_back_rows_and_removes_new_demo_files(self):
        with TemporaryDirectory(prefix='seedlings-demo-test-') as directory:
            storage = FileSystemStorage(location=directory, base_url='/media/')
            with patch.object(Command, 'validate_environment', return_value=storage):
                create = NurseryPhoto.objects.create
                calls = []
                def fail_second(*args, **kwargs):
                    calls.append(True)
                    if len(calls) == 2:
                        raise RuntimeError('Simulated failure')
                    return create(*args, **kwargs)
                with patch.object(NurseryPhoto.objects, 'create', side_effect=fail_second):
                    with self.assertRaisesMessage(RuntimeError, 'Simulated failure'):
                        call_command('seed_demo_nursery_photos', stdout=StringIO())
                self.assertFalse(NurseryPhoto.objects.exists())
                self.assertEqual(list(Path(directory).rglob('*.jpg')), [])
