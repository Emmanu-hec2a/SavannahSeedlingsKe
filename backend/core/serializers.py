# core/serializers.py
from dj_rest_auth.registration.serializers import RegisterSerializer
from django.contrib.auth import get_user_model
from allauth.account.models import EmailAddress
from rest_framework import serializers

class CustomRegisterSerializer(RegisterSerializer):
    username = None

    def validate_email(self, value):
        value = super().validate_email(value.strip().lower())
        if (get_user_model().objects.filter(email__iexact=value).exists()
                or EmailAddress.objects.filter(email__iexact=value).exists()):
            raise serializers.ValidationError('An account with this email already exists. Please sign in instead.')
        return value

    def get_cleaned_data(self):
        # Using .get() with fallback strings ensures the serializer never
        # crashes if passwords or usernames are omitted during social signup
        return {
            'email': self.validated_data.get('email', ''),
            'password1': self.validated_data.get('password1', ''),
            'password2': self.validated_data.get('password2', ''),
        }
