from django.db import transaction
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Error
from dj_rest_auth.registration.views import RegisterView, SocialLoginView
from requests.exceptions import RequestException
from rest_framework.exceptions import ValidationError


class CustomerRegisterView(RegisterView):
    @transaction.atomic
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except (OAuth2Error, RequestException) as exc:
            raise ValidationError({'non_field_errors': ['Google sign-in could not be verified. Please try again.']}) from exc
