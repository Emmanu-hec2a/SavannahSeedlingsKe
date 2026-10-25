from django.conf import settings
from django.db import models


class AdminSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='admin_sessions')
    token_digest = models.CharField(max_length=64, unique=True, editable=False)
    password_signature = models.CharField(max_length=64, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
