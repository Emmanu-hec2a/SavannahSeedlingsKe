from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(
        name='AdminSession',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('token_digest', models.CharField(max_length=64, unique=True, editable=False)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('expires_at', models.DateTimeField(db_index=True)),
            ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.CASCADE, related_name='admin_sessions')),
        ],
    )]
