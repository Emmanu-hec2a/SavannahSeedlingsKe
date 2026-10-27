import importlib.util
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase


class ManualUploadImportTests(SimpleTestCase):
    def test_discovering_legacy_upload_script_cannot_read_or_upload_an_image(self):
        filename = Path(__file__).resolve().parents[1] / 'test_upload.py'
        spec = importlib.util.spec_from_file_location('qa_legacy_upload', filename)
        module = importlib.util.module_from_spec(spec)
        with patch('requests.post') as upload, patch('builtins.open') as open_file:
            spec.loader.exec_module(module)
        upload.assert_not_called()
        open_file.assert_not_called()
