"""Explicit, idempotent demo seeding; refuse ordinary settings or remote storage."""
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.files.storage import FileSystemStorage
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from core.models import NurseryPhoto
from core.views_nursery import prepare_photo, delete_photo_files

PHOTOS = [
    ('nursery-wide', 'Demo - Nursery growing space', 'Stock photo of young plants on benches inside a greenhouse.'),
    ('citrus-seedling', 'Demo - A healthy citrus seedling', 'Stock photo of a small citrus seedling with water droplets on its leaves.'),
    ('potted-seedlings', 'Demo - Seedlings in pots', 'Stock photo of three young seedlings growing in individual pots.'),
]


class Command(BaseCommand):
    help = 'Add three stock nursery photos to the isolated local demo (demo_settings only).'

    def validate_environment(self):
        root = (settings.BASE_DIR / '.local-demo').resolve()
        database = connection.settings_dict
        storage = NurseryPhoto._meta.get_field('image').storage
        if (not getattr(settings, 'LOCAL_DEMO_MODE', False) or not settings.DEBUG
                or database['ENGINE'] != 'django.db.backends.sqlite3'
                or Path(database['NAME']).resolve() != root / 'db.sqlite3'
                or not isinstance(storage, FileSystemStorage)
                or Path(storage.location).resolve() != root / 'media'
                or settings.MEDIA_URL != '/media/'):
            raise CommandError('Demo photos require --settings=tinahstore.demo_settings. No database or storage changes were made.')
        return storage

    def handle(self, *args, **options):
        storage = self.validate_environment()
        source_root = settings.BASE_DIR.parent / 'tinahstore' / 'public' / 'images' / 'hero'
        prepared, uploads = [], []
        created = 0
        try:
            # Validate all source photographs before writing anything.
            for slug, _, _ in PHOTOS:
                source = source_root / f'{slug}.webp'
                if not source.is_file():
                    raise CommandError(f'Missing local demo photo: {source.name}')
                with source.open('rb') as stream:
                    prepared.append(prepare_photo(File(stream, name=source.name)))
            with transaction.atomic():
                for position, ((slug, caption, alt_text), content) in enumerate(zip(PHOTOS, prepared)):
                    name = f'nursery/demo/{slug}.jpg'
                    if NurseryPhoto.objects.filter(image=name).exists():
                        continue  # Preserve captions/order/visibility changed in admin.
                    if not storage.exists(name):
                        uploads.append((storage, name))
                        saved = storage.save(name, content)
                        if saved != name:
                            uploads.append((storage, saved))
                            raise CommandError('Demo file changed concurrently. Please retry.')
                    NurseryPhoto.objects.create(image=name, caption=caption, alt_text=alt_text,
                        position=position, is_active=True,
                        is_featured=position == 0 and not NurseryPhoto.objects.filter(is_featured=True).exists())
                    created += 1
        except Exception:
            delete_photo_files(uploads)
            raise
        finally:
            for content in prepared:
                content.close()
        self.stdout.write(self.style.SUCCESS(
            f'Added {created} demo nursery photos; existing records left unchanged. Local database and files only.'))
