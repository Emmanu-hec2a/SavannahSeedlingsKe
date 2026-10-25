from datetime import timedelta
from hashlib import sha256
import secrets
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.authtoken.serializers import AuthTokenSerializer
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from .authentication import AdminSessionAuthentication
from .models import AdminSession


def user_details(user):
    return {'id': user.pk, 'username': user.get_username(), 'email': user.email, 'is_staff': user.is_staff}


class PrivateAdminAPIView(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class AdminLoginView(PrivateAdminAPIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'admin_login'

    def post(self, request):
        credentials = AuthTokenSerializer(data=request.data, context={'request': request})
        credentials.is_valid(raise_exception=True)
        user = credentials.validated_data['user']
        if not user.is_staff:
            return Response({'detail': 'A staff account is required for the nursery dashboard.'}, status=403)
        raw_token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(seconds=settings.ADMIN_SESSION_TTL_SECONDS)
        AdminSession.objects.filter(user=user, expires_at__lte=timezone.now()).delete()
        AdminSession.objects.create(user=user, token_digest=sha256(raw_token.encode()).hexdigest(),
                                    password_signature=user.get_session_auth_hash(), expires_at=expires_at)
        return Response({'token': raw_token, 'user': user_details(user), 'expires_at': expires_at})


class AdminSessionView(PrivateAdminAPIView):
    authentication_classes = [AdminSessionAuthentication]
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response({'user': user_details(request.user), 'expires_at': request.auth.expires_at})


class AdminLogoutView(AdminSessionView):
    http_method_names = ['post', 'options']

    def post(self, request):
        request.auth.delete()
        return Response(status=204)


class AdminPasswordView(AdminSessionView):
    http_method_names = ['post', 'options']

    @transaction.atomic
    def post(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        if not isinstance(old_password, str) or not request.user.check_password(old_password):
            raise serializers.ValidationError({'detail': 'Current password is incorrect.'})
        if not isinstance(new_password, str):
            raise serializers.ValidationError({'detail': 'Enter a new password.'})
        try:
            validate_password(new_password, request.user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({'detail': ' '.join(error.messages)})
        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        AdminSession.objects.filter(user=request.user).delete()
        return Response({'detail': 'Password changed. Sign in again with your new password.'})
