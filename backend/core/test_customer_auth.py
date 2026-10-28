"""Customer auth against real local endpoints; only Google's userinfo is mocked."""
from unittest.mock import patch

from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount, SocialToken
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Error
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    SOCIALACCOUNT_PROVIDERS={'google': {'APP': {
        'client_id': 'qa-only.apps.googleusercontent.com', 'secret': 'qa-only', 'key': '',
    }, 'SCOPE': ['profile', 'email']}},
)
class CustomerSignupTests(TestCase):
    password = 'Nursery-Test-Password-482!'

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.network = patch('requests.sessions.Session.request', side_effect=AssertionError('External network forbidden'))
        self.network.start()
        self.addCleanup(self.network.stop)

    def signup(self, email='grower@example.test', **overrides):
        payload = {'email': email, 'password1': self.password, 'password2': self.password, **overrides}
        return self.client.post('/api/v1/auth/registration/', payload, format='json')

    def google(self, number=1, email=None):
        info = {'id': f'qa-google-{number}', 'email': email or f'google{number}@example.test',
                'verified_email': True, 'name': 'QA Grower'}
        with patch.object(GoogleOAuth2Adapter, '_fetch_user_info', return_value=info):
            return self.client.post('/api/v1/auth/google/', {'access_token': 'qa-not-real'}, format='json')

    def assert_session(self, response, email, status=201):
        self.assertEqual(response.status_code, status, getattr(response, 'data', None))
        key = response.data['key']
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Token {key}')
        profile = client.get('/api/v1/auth/user/')
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data['email'], email)
        self.assertTrue(profile.data['username'])

    def test_multiple_email_signups_generate_unique_usernames_and_usable_tokens(self):
        for number in (1, 2, 3):
            email = f'grower{number}@example.test'
            self.assert_session(self.signup(email), email)
        names = list(get_user_model().objects.values_list('username', flat=True))
        self.assertEqual(len(set(names)), 3)
        self.assertNotIn('', names)

    def test_existing_blank_username_account_is_unchanged(self):
        old = get_user_model().objects.create_user(username='temporary-legacy', email='old@example.test', password=self.password)
        get_user_model().objects.filter(pk=old.pk).update(username='')
        self.assert_session(self.signup(), 'grower@example.test')
        old.refresh_from_db()
        self.assertEqual(old.username, '')
        login = self.client.post('/api/v1/auth/login/', {'email': old.email, 'password': self.password}, format='json')
        self.assertEqual(login.status_code, 200)

    def test_multiple_google_signups_and_repeat_login_without_google_token_storage(self):
        for number in (1, 2, 1):
            self.assert_session(self.google(number), f'google{number}@example.test', status=200)
        self.assertEqual(get_user_model().objects.count(), 2)
        self.assertEqual(SocialAccount.objects.count(), 2)
        self.assertEqual(SocialToken.objects.count(), 0)

    def test_duplicate_unverified_email_is_rejected_case_insensitively(self):
        self.assertEqual(self.signup('grower@example.test').status_code, 201)
        self.assertFalse(EmailAddress.objects.get().verified)
        response = self.signup('GROWER@EXAMPLE.TEST')
        self.assertEqual(response.status_code, 400)
        self.assertIn('sign in', str(response.data).lower())
        self.assertEqual(get_user_model().objects.count(), 1)

    def test_duplicate_legacy_email_without_emailaddress_is_rejected(self):
        get_user_model().objects.create_user(username='legacy', email='Grower@example.test')
        self.assertEqual(self.signup('grower@example.test').status_code, 400)
        self.assertEqual(get_user_model().objects.count(), 1)

    def test_google_does_not_merge_a_password_account(self):
        self.signup('grower@example.test')
        response = self.google(email='grower@example.test')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertFalse(SocialAccount.objects.exists())

    def test_invalid_passwords_create_nothing(self):
        for overrides in ({'password2': 'Different-Password-123!'}, {'password1': '', 'password2': ''}):
            self.assertEqual(self.signup(**overrides).status_code, 400)
        self.assertFalse(get_user_model().objects.exists())

    def test_email_signup_failure_rolls_back_user_email_and_token(self):
        with patch('core.views_auth.CustomerRegisterView.get_response_data', side_effect=RuntimeError('QA response failure')):
            with self.assertRaises(RuntimeError):
                self.signup()
        self.assertFalse(get_user_model().objects.exists())
        self.assertFalse(EmailAddress.objects.exists())
        self.assertFalse(Token.objects.exists())

    def test_google_failure_rolls_back_new_account_and_token(self):
        with patch('core.views_auth.GoogleLogin.get_response', side_effect=RuntimeError('QA response failure')):
            with self.assertRaises(RuntimeError):
                self.google()
        self.assertFalse(get_user_model().objects.exists())
        self.assertFalse(EmailAddress.objects.exists())
        self.assertFalse(SocialAccount.objects.exists())
        self.assertFalse(Token.objects.exists())

    def test_invalid_google_token_returns_validation_error_not_server_error(self):
        with patch.object(GoogleOAuth2Adapter, '_fetch_user_info', side_effect=OAuth2Error('Invalid token')):
            response = self.client.post('/api/v1/auth/google/', {'access_token': 'qa-invalid'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(get_user_model().objects.exists())

    def test_email_login_accepts_correct_password_and_rejects_incorrect(self):
        self.signup()
        for password, status in ((self.password, 200), ('Wrong-Password-482!', 400)):
            response = self.client.post('/api/v1/auth/login/', {'email': 'grower@example.test', 'password': password}, format='json')
            self.assertEqual(response.status_code, status, response.data)
