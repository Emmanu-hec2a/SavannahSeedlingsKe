from hashlib import sha256
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from .models import AdminSession


class AdminSessionAuthentication(BaseAuthentication):
    keyword = 'AdminToken'

    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts or parts[0].lower() != self.keyword.lower().encode():
            return None
        if len(parts) != 2 or len(parts[1]) > 256:
            raise AuthenticationFailed('Invalid admin session. Please sign in again.')
        digest = sha256(parts[1]).hexdigest()
        try:
            session = AdminSession.objects.select_related('user').get(token_digest=digest)
        except AdminSession.DoesNotExist:
            raise AuthenticationFailed('Invalid admin session. Please sign in again.')
        if session.expires_at <= timezone.now() or not session.user.is_active or not session.user.is_staff:
            session.delete()
            raise AuthenticationFailed('Your admin session has ended. Please sign in again.')
        return session.user, session

    def authenticate_header(self, request):
        return self.keyword
