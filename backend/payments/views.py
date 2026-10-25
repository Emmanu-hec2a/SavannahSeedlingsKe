import json
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from django.utils.crypto import constant_time_compare
from rest_framework.response import Response
from rest_framework import status, generics
from django.shortcuts import get_object_or_404
from orders.models import Order
from .models import MpesaTransaction
from .serializers import MpesaTransactionSerializer
from .services.mpesa import mpesa_service
from core.services.telegram import telegram_service

class MpesaTransactionListView(generics.ListAPIView):
    queryset = MpesaTransaction.objects.all().order_by('-created_at')
    serializer_class = MpesaTransactionSerializer
    permission_classes = [IsAdminUser]

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def mpesa_callback(request):
    """
    Handles M-PESA Daraja callback.
    --- Callback Parsing Logic ---
    1. Parse the JSON payload from Safaricom.
    2. Extract CheckoutRequestID to find the corresponding transaction.
    3. If ResultCode is 0 (Success), extract the M-PESA receipt number 
       from CallbackMetadata and update the order status to 'confirmed'.
    4. If ResultCode is non-zero (Failure), record the description.
    5. Always return a success response to Safaricom to prevent retries.
    """
    data = request.data
    stk_callback = data.get('Body', {}).get('stkCallback', {})
    
    checkout_request_id = stk_callback.get('CheckoutRequestID')
    result_code = stk_callback.get('ResultCode')
    result_desc = stk_callback.get('ResultDesc')
    
    transaction = get_object_or_404(MpesaTransaction, checkout_request_id=checkout_request_id)
    order = transaction.order
    
    transaction.result_code = result_code
    transaction.result_desc = result_desc
    
    if result_code == 0:
        # Success
        metadata = stk_callback.get('CallbackMetadata', {}).get('Item', [])
        for item in metadata:
            if item.get('Name') == 'MpesaReceiptNumber':
                transaction.mpesa_receipt_number = item.get('Value')
                break
        
        # Use standardized confirmation logic
        order.confirm_deposit_payment()
        
        # Send Telegram Alert for payment confirmation
        try:
            telegram_service.notify_payment_confirmed(order, transaction.mpesa_receipt_number)
        except Exception as e:
            print(f"Telegram Notify Error: {e}")
        
    transaction.save()
    
    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

@api_view(['POST'])
@permission_classes([IsAdminUser])
def mpesa_initiate(request):
    """
    Re-initiates STK Push for an existing pending order.
    """
    order_number = request.data.get('order_number')
    order = get_object_or_404(Order, order_number=order_number)
    
    if order.status != 'pending_deposit' or order.deposit_paid:
        return Response(
            {"error": "Only pending_deposit orders with unpaid deposits can be re-initiated."},
            status=status.HTTP_400_BAD_REQUEST
        )
        
    try:
        stk_response = mpesa_service.initiate_stk_push(order)
    except ValueError as error:
        return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)
    
    if stk_response.get('ResponseCode') == '0':
        checkout_request_id = stk_response.get('CheckoutRequestID')
        merchant_request_id = stk_response.get('MerchantRequestID')
        
        MpesaTransaction.objects.create(
            order=order,
            checkout_request_id=checkout_request_id,
            merchant_request_id=merchant_request_id,
            phone_number=order.customer_phone,
            amount=order.deposit_amount
        )
        
        return Response({"checkout_request_id": checkout_request_id})
    else:
        return Response(stk_response, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def mpesa_query(request):
    """
    Queries M-PESA for the status of a transaction.
    """
    checkout_request_id = request.data.get('checkout_request_id')
    transaction = get_object_or_404(MpesaTransaction, checkout_request_id=checkout_request_id)
    order = transaction.order
    query_response = mpesa_service.query_stk_push(checkout_request_id)
    
    # If successful query and payment was successful
    if query_response.get('ResultCode') == '0' and order.status == 'pending_deposit':
        # Apply confirmation logic
        order.deposit_paid = True
        order.status = 'confirmed'
        order.save()
        
        transaction.result_code = 0
        transaction.result_desc = "Success (from query)"
        transaction.save()
        
    return Response({
        "status": order.status,
        "deposit_paid": order.deposit_paid
    })

@api_view(['GET'])
def mpesa_status(request, checkout_request_id):
    """
    Polling endpoint for the frontend.
    """
    transaction = get_object_or_404(MpesaTransaction, checkout_request_id=checkout_request_id)
    order = transaction.order
    if not (request.user.is_staff or
            (request.user.is_authenticated and order.user_id == request.user.pk) or
            constant_time_compare(str(order.access_token), request.headers.get('X-Order-Token', ''))):
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
    
    return Response({
        "deposit_paid": order.deposit_paid,
        "order_status": order.status,
        "order_number": order.order_number
    })
