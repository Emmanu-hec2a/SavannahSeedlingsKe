# WhatsApp checkout and customer signup — 28 October 2026

Implemented locally. No production accounts, orders, credentials, messages or
deployment settings were changed. No live Google/WhatsApp requests were used by
the checks. Existing saved accounts and orders were not renamed or backfilled.

## What changed

- Checkout reserves from batch totals whenever batches exist, including an
  all-zero total. Only products without batches use legacy product-level stock.
- Explicit batch requests are reserved first; general requests draw from batches
  in ascending ID order. Combined requests cannot spend the same stock twice.
- Product-first/batch-second locks and a single transaction protect validation,
  pricing, order creation, deductions and the internal allocation ledger.
- `orders.0008_orderstockallocation` adds a positive-quantity allocation record
  linked to each order item and its batch (null means legacy product stock).
  Customer-facing receipt lines and successful order response fields are unchanged.
- Cancellation releases each recorded allocation once, to its original source.
  Historical orders retain their old source behavior; a release marker is recorded
  only when cancelling them, not through a guessed bulk backfill.
- Used batches cannot be removed through product edits or direct ORM deletion.
  Product/category API deletion returns HTTP 409 for inventory used by saved orders.
- Checkout errors retain the existing `items` message and add `stock_issues` with
  product slug/name, optional batch ID, requested quantity and available quantity.
  DRF validation values can be strings; the UI renders them without assuming numbers.
- Failed checkout keeps the cart and entered form fields, closes the unused popup,
  identifies stock shortages and offers an edit-cart link. Successful retries retain
  checkout-key behavior; WhatsApp still requires the customer to send the message.
- WhatsApp orders remain unpaid and awaiting confirmation, with delivery quoted by
  the nursery. Prices are calculated on the server, not trusted from the cart.
- Email signup remains email-only, but allauth now generates the username required
  by the existing user model. Existing blank usernames are preserved.
- New Google access tokens are no longer stored. Identity validation, Google social
  account records and the application's own authentication token remain in use.
- Signup endpoints are transactional; response/token failures roll back account
  creation. Duplicate email signup is rejected case-insensitively, including
  unverified/legacy emails. Google does not automatically merge password accounts.
- Both signup methods validate the application token, fetch the profile and open
  the signed-in `/account` page. Missing tokens/profile failures do not accept partial
  sessions. Pending states and request guards prevent duplicate submissions.
- Validation errors are readable rather than raw JSON. Server/proxy traces are
  replaced with safe fallback text. Password validation was not weakened.

## Verification

- Full isolated backend suite: **133 discovered, 129 passed, 4 skipped**. Skips are
  the opt-in browser test and three PostgreSQL-only concurrency tests.
- Migration consistency: `makemigrations --check --dry-run` passed.
- Storefront production build: passed (Vite 7.3.5).
- Error formatting: **12 checks passed**.
- Auth browser checks: **23 checks passed**, with local Google/API fixtures.
- Real-backend signup/checkout browser checks: **7 passed**, including multiple
  email signups, reload restoration, duplicate-email handling, admin-created batch
  stock, a real shortage, replenishment/retry and repeat cancellation.
- Existing catalog/homepage browser regression: **30 passed**, including stock,
  visibility, uploaded photos, pagination, homepage limits, counters and services.
- Browser runs reported no script errors. Their expected HTTP 400s exercise
  duplicate-email/stock validation; catalog HTTP 503s are deliberately injected.
- Checkout shortage layout was checked at 320, 390, 768 and 1280px without overflow.
- Browser helpers clean up their own disposable profiles, unless screenshots were
  explicitly requested. No unrelated browser profiles were removed.

## Release gates still outstanding

1. PostgreSQL concurrency verification is **not yet passed**. A disposable PostgreSQL
   18 cluster started, but test-database creation failed with `No space left on
   device`. The owned server stopped and its temporary cluster was cleaned up.
   The runner now requires at least 200 MB free before attempting another run.
   Three tests cover competing orders, identical checkout retries and simultaneous
   cancellation. SQLite skips these because it cannot prove row-lock behavior.
2. The available local Python environment is Django **4.2.7**, allauth **65.15.0**,
   dj-rest-auth **7.2.0**, psycopg2 **2.9.10**. The project declares Django >=5,<6.
   Repeat the suite in the intended production dependency environment before release;
   this task did not replace global dependencies or silently upgrade the project.
3. Live Google Console origins, deployed client-ID consistency and production API
   configuration have not been audited. Local Google checks validate the application
   exchange/account behavior with mocked provider responses, not a live Google login.

## Repeat checks and deployment order

From `backend`:

```powershell
python -B manage.py test --settings=tinahstore.test_settings --noinput
python -B manage.py makemigrations --check --dry-run --settings=tinahstore.test_settings
python -B scripts/check_checkout_postgres.py
$env:RUN_ADMIN_BROWSER_TESTS='1'
$env:ADMIN_ACTIONS_FOCUS='checkout-signup' # repeat with catalog-sync as well
python -B manage.py test core.test_admin_actions.AdminActionsBrowserTests --settings=tinahstore.test_settings --noinput
```

The PostgreSQL runner uses only an owned temporary cluster bound to 127.0.0.1;
it never uses `DATABASE_URL`. PostgreSQL server binaries must be on PATH.

From `tinahstore`: `npm run build`, `npm run test:errors`, `npm run test:auth`.

After release gates pass, coordinate deployment separately: back up the database,
apply `python manage.py migrate` (including `orders.0008_orderstockallocation`) and
release the backend **before** the storefront. The migration is additive and does
not recalculate existing stock. Do not drop the allocation table as a routine rollback:
its records are needed to restore stock for newly saved orders.

Perform agreed production smoke checks for email/Google signup and one controlled
order/cancellation, monitor validation/500 responses, and verify storefront stock.
Do not send real WhatsApp messages or create live orders without coordination.
