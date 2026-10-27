from django.conf import settings
from django.db import models


class AdminSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='admin_sessions')
    token_digest = models.CharField(max_length=64, unique=True, editable=False)
    password_signature = models.CharField(max_length=64, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)


class NurseryPhoto(models.Model):
    image = models.ImageField(upload_to='nursery/', max_length=255)
    caption = models.CharField(max_length=200, blank=True)
    alt_text = models.CharField(max_length=200)
    position = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_featured', 'position', 'pk']
        constraints = [models.UniqueConstraint(
            fields=['is_featured'], condition=models.Q(is_featured=True),
            name='one_featured_nursery_photo',
        )]
