# WhatsApp checkout

Apply migrations when deploying the backend, before deploying the new storefront:

```sh
python manage.py migrate
```

WhatsApp checkout does not require Daraja credentials. Existing orders and their
amounts are preserved by migration `0007_whatsapp_checkout`.

The storefront's `VITE_API_BASE_URL` accepts either the backend origin or a full
URL ending in `/api/v1`. Rebuild the storefront after changing environment values.

New WhatsApp orders use `pending_confirmation`. Delivery fee and payable amounts
are **null**, not zero, until staff save the agreed delivery fee in the admin
order detail page. Prices come from the product records, not the browser.
The subtotal is calculated from saved order items. Quoting delivery calculates
the final total and moves the order to `pending_deposit` (awaiting payment).
Staff must independently verify payment before marking the order paid.

The storefront opens a prepared WhatsApp message after saving. It cannot verify
whether the buyer sends it. Confirmation always offers the same message again,
and refreshes the saved status when the customer returns to the tab.

The checkout UUID deduplicates retries. Guest order details require the order's
unguessable access token in `X-Order-Token`; guessing an order number is not enough.
The confirmation URL contains only the order number. The token and saved order
remain in the browser's tab/session, so customers should keep the confirmation
tab or use their signed-in account for subsequent access.

Stock is reserved when an order is saved, matching the existing behavior.
Staff should cancel abandoned orders to release stock. Cancellation restocks
only once. Automatic reservation expiry is not implemented.

Daraja service code is retained, but automated payments are not offered in the
new storefront. Before enabling M-PESA as primary, review callback verification,
credentials, transaction reconciliation, payment failure handling and production
testing. Transaction listings and manual STK/query actions now require staff.

Run isolated API tests without using the application database:

```sh
python manage.py test orders --settings=tinahstore.test_settings --noinput
```

Tests use an in-memory SQLite database and mock outbound payment/notification
calls. They do not send WhatsApp messages, Telegram messages or STK pushes.
