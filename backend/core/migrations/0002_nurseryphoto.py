from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('core', '0001_admin_session')]
    operations = [migrations.CreateModel(
        name='NurseryPhoto',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('image', models.ImageField(max_length=255, upload_to='nursery/')),
            ('caption', models.CharField(blank=True, max_length=200)),
            ('alt_text', models.CharField(max_length=200)),
            ('position', models.PositiveIntegerField(default=0)),
            ('is_active', models.BooleanField(default=True)),
            ('is_featured', models.BooleanField(default=False)),
            ('updated_at', models.DateTimeField(auto_now=True)),
        ],
        options={
            'ordering': ['-is_featured', 'position', 'pk'],
            'constraints': [models.UniqueConstraint(fields=('is_featured',), condition=models.Q(is_featured=True),
                                                  name='one_featured_nursery_photo')],
        },
    )]
