import base64
import requests
from datetime import datetime
from django.conf import settings
from django.core.cache import cache

class MpesaService:
    def __init__(self):
        self.consumer_key = settings.MPESA_CONSUMER_KEY
        self.consumer_secret = settings.MPESA_CONSUMER_SECRET
        self.shortcode = settings.MPESA_SHORTCODE
        self.passkey = settings.MPESA_PASSKEY
        self.env = settings.MPESA_ENV
        
        if self.env == 'sandbox':
            self.base_url = "https://sandbox.safaricom.co.ke"
        else:
            self.base_url = "https://api.safaricom.co.ke"

    def get_access_token(self):
        """
        Retrieves the M-PESA access token using consumer key and secret.
        --- Daraja Auth Token Caching Strategy ---
        To avoid unnecessary API calls and respect Safaricom's rate limits, 
        we cache the access token in Django's cache backend.
        The token is cached for (expires_in - 30) seconds as per requirements.
        """
        if not all((self.consumer_key, self.consumer_secret, self.shortcode, self.passkey, settings.MPESA_CALLBACK_URL)):
            raise ValueError('M-PESA is not configured yet. Arrange payment with the nursery on WhatsApp.')
        # Check cache first
        access_token = cache.get('mpesa_access_token')
        if access_token:
            return access_token

        # Generate new token
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        auth_string = f"{self.consumer_key}:{self.consumer_secret}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {encoded_auth}"
        }
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        access_token = data['access_token']
        expires_in = int(data['expires_in'])
        
        # Cache for (expires_in - 30) seconds
        cache.set('mpesa_access_token', access_token, expires_in - 30)
        
        return access_token

    def get_password(self, timestamp):
        password_str = f"{self.shortcode}{self.passkey}{timestamp}"
        return base64.b64encode(password_str.encode()).decode()

    def initiate_stk_push(self, order):
        if order.delivery_fee is None or order.deposit_amount is None:
            raise ValueError('Save the agreed delivery fee before requesting payment.')
        access_token = self.get_access_token()
        url = f"{self.base_url}/mpesa/stkpush/v1/processrequest"
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        password = self.get_password(timestamp)
        
        # Normalize phone number to 254XXXXXXXXX
        phone = order.customer_phone
        if phone.startswith('0'):
            phone = '254' + phone[1:]
        elif phone.startswith('+'):
            phone = phone[1:]
        elif not phone.startswith('254'):
            phone = '254' + phone
            
        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(order.deposit_amount), # M-PESA amount must be integer for some versions, but Daraja allows float. Prompt says order.deposit_amount.
            "PartyA": phone,
            "PartyB": self.shortcode,
            "PhoneNumber": phone,
            "CallBackURL": settings.MPESA_CALLBACK_URL,
            "AccountReference": order.order_number,
            "TransactionDesc": f"Savannah Seedlings payment for order {order.order_number}"
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, json=payload, headers=headers)
        return response.json()

    def query_stk_push(self, checkout_request_id):
        access_token = self.get_access_token()
        url = f"{self.base_url}/mpesa/stkpushquery/v1/query"
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        password = self.get_password(timestamp)
        
        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, json=payload, headers=headers)
        return response.json()

mpesa_service = MpesaService()
