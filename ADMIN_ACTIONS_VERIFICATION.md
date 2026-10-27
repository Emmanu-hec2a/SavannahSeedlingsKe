# Admin actions verification — 26 October 2026

## Current status — four remaining regression failures resolved

The stock-display, product-visibility, delivery-save and negative-fee failures are
fixed locally. No schema changes or new migrations are required.

- Full backend run: **82 discovered, 81 passed, 1 optional browser test skipped**.
  There are no remaining failures in the core/orders/products backend suite.
- Focused real-API browser run: **14 passed**, with the two known product-form
  scenarios explicitly skipped as outside this fix. No JavaScript errors.
- Existing admin auth/page browser regression run: **20 passed**.
- Admin production build passes. Its existing chunk-size warning is advisory.

Verified behavior:

- Catalog and product detail both use the batch-stock total, including zero; an
  unbatched product still uses its product-level stock. Legacy stock writes remain
  supported. The browser displayed edited stock and the zero-stock state correctly.
- Anonymous/customer catalog requests exclude inactive products, and direct
  inactive detail/related URLs return 404. Staff can still list, edit and reactivate
  them. The browser verified hiding and reactivating a product in the storefront.
- Settings supports PATCH and PUT, including legacy partial PUT updates. Both
  fields are validated as nonnegative two-decimal amounts before anything is
  saved; invalid requests leave both rates and their timestamp unchanged.
- The admin form enforces minimum/maximum values, preserves entered decimal
  values in its payload and displays field-specific API errors. Valid changes
  survived a reload in the real-API browser check; negative values were blocked.
- Public numeric delivery-rate responses remain compatible. Global legacy rates
  do not reprice existing WhatsApp orders or pre-quote new WhatsApp checkouts.
- Password mismatch, wrong-current-password rejection, successful change,
  session revocation, old-login rejection and new-login return to Settings also
  passed in the focused real-API browser run.

Run the backend checks from `backend`:

```sh
python -B manage.py test core orders products --settings=tinahstore.test_settings --noinput
```

For focused cross-app browser checks, first build both frontends, then run from
`backend` in PowerShell:

```powershell
$env:RUN_ADMIN_BROWSER_TESTS = '1'
$env:ADMIN_ACTIONS_FOCUS = 'catalog-delivery'
python -B manage.py test core.test_admin_actions.AdminActionsBrowserTests --settings=tinahstore.test_settings --noinput
Remove-Item Env:RUN_ADMIN_BROWSER_TESTS
Remove-Item Env:ADMIN_ACTIONS_FOCUS
```

The harness reports the two excluded scenarios by name. Photo-removal behavior
and clearing Original Price remain open; they were not silently counted as passes
or changed as part of this follow-up. No deployment or live data changes were made.
Deploy the backend and rebuilt admin panel to publish these fixes. Stock and
visibility are API-driven and do not require a storefront code change.

## Previous checkpoint — Step 1: protecting saved data

The product-save safety fix is implemented locally. **54 focused checks pass**:
the original 28 authentication/checkout checks, 24 new save-safety checks, and the
two previously failing rejected-update/invalid-upload checks.

At this checkpoint the full backend discovery run executed **63 tests: 58 passed,
4 failed, 1 skipped**. The remaining failures were deliberately deferred: public product visibility,
detail-page stock calculation, delivery PATCH support, and negative delivery fees.
That historical result is superseded by the passing current run above.

Implemented in `backend/products/saves.py` and `backend/products/views.py`:

- Validate product fields, batch JSON/ownership/stock values, and every uploaded
  image before writing. Invalid images now return 400; the existing UI's 5 MB
  image limit is enforced server-side.
- Save the product, batches and image records within a database transaction.
  Invalid requests and later database/storage/response-serialization failures
  cannot leave partially changed product records.
- Lock the product and its batches during updates. Update existing batch IDs in
  place, preserving order links. Reject removal of a batch referenced by orders.
  Existing admin payloads using `Standard` batch size remain accepted.
- Use fresh, checked UUID image keys. Never overwrite older photos. If a request
  fails, compensate only its newly attempted/uploaded keys, including an upload
  that writes then reports a failure. Preserve existing image records and files.
- Report upload failures as 503 instead of pretending the product saved.

**Storage limitation:** R2 is not part of the database transaction. Cleanup is
best-effort: if deletion itself fails, log `Failed product upload needs cleanup:`
with the exact new object key and keep the original request error. An operator
must retry that exact key; this patch does not add a background cleanup queue.
A server crash can also interrupt cleanup. Live R2 failure behavior has not been
tested, and this patch does not repair data damaged by earlier saves.

Reproduce the focused passing run from `backend`:

```sh
python -B manage.py test core.tests orders products.test_save_safety core.test_admin_actions.AdminActionTests.test_invalid_product_edit_does_not_replace_stock_or_add_images core.test_admin_actions.AdminActionTests.test_invalid_uploaded_image_is_rejected_not_silently_ignored --settings=tinahstore.test_settings --noinput
```

Run the full suite (the previously deferred failures now pass):

```sh
python -B manage.py test core orders products --settings=tinahstore.test_settings --noinput
```

At Step 1 only backend product-save behavior was changed. This follow-up also
fixes delivery settings and stock/visibility; the two product-form issues remain open.
No production objects, accounts, or settings were modified or deployed.

## Initial verification outcome (before Step 1)

Not a clean pass. The repeatable backend run executed **38 tests: 32 passed and
6 failed**. The original 28 authentication/WhatsApp-order tests still pass; the
10 new admin-action tests have 4 passes and 6 failures.

No production products, passwords, delivery settings, database records, or R2
objects were changed. This initial verification preceded the Step 1 fix above.

## Initial confirmed results (before fixes)

| Action | Result |
| --- | --- |
| Upload a valid image with a new product and stock batch | Pass: multipart data saves, the image is converted to JPEG/resized, and public product APIs expose it. Real-browser runs also displayed the new product and its uploaded photo in the shop. |
| Edit product price, description, planting guide, category and image | These fields persist and are returned by the public list/detail APIs. Browser runs confirmed price/text changes after navigation. Stock is inconsistent; see below. |
| Change the QA staff password | API pass: the old password stops working, the new password signs in, and the old admin session is rejected. Existing tests also cover wrong current/weak new passwords and revoking every admin session. Full browser UI sign-off is incomplete. |
| Restrict delivery-setting writes | Pass: anonymous/customer writes are rejected. A staff PUT saves and can be read back, but the actual admin form uses PATCH and fails. |

## Initial reproducible defects (before fixes)

| Priority | Finding | Evidence / source |
| --- | --- | --- |
| High | A rejected product edit can still replace saved variants and add images before validation. | Send an invalid price together with variants/images: response is 400, but the original variant has already been deleted. `backend/products/views.py`, `ProductDetailView.update`, mutates children before serializer validation and has no enclosing transaction. |
| High | Settings delivery-fee save fails with HTTP 405. | `admin-panel/src/pages/Settings.jsx` calls PATCH; `backend/orders/views.py`, `DeliverySettingView`, implements PUT only. |
| High | Hiding a product does not remove it from the public shop. | After `is_active=false`, unauthenticated product-list reads still contain the product. `ProductListView.get_queryset` does not filter inactive products for public readers. A browser run also reproduced the visible card. |
| High | Product-detail stock disagrees with nursery batch stock. | After setting a batch to 7, public catalog stock is 7 but product-detail stock remains the old product-level stock (12 in the API fixture, 0 for a new browser-created product). `ProductListSerializer` totals variants; `ProductDetailSerializer` returns the model's independent stock field. |
| Medium | An invalid image is silently ignored while product creation reports success. | Uploading a broken PNG returns 201 rather than an upload validation error. Image-processing exceptions are printed and swallowed in `backend/products/views.py`. |
| Medium | Negative delivery fees are accepted by the supported backend PUT endpoint. | A staff update of Nairobi fee to -25 returns 200 and saves the negative value. There is no serializer/range validation in `DeliverySettingView.put`. |

Two additional UI defects were observed in partial browser runs and corroborated
by the current form code. These two remain open and outside the current fix:

- Clearing **Original Price** leaves the previous value saved. ProductForm omits
  an empty value from FormData instead of explicitly clearing it; the test value
  remained `600.00` after save.
- Clicking **Remove** on a product photo submits the entire product form. Its
  button lacks `type="button"`. Also, ProductForm tracks removal only in local
  state; the save payload has no deletion instruction for an existing photo.

## Storefront synchronization limits

The admin and storefront read/write the same product API contract. Successful
price/text/image changes are visible on a fresh storefront fetch/navigation;
there is no product-change subscription or background refresh in `useProducts`.
An already-open shop/product page does not automatically update in place.

This does **not** certify deployed R2 uploads, CDN invalidation, the production
database, or production frontend environment-variable alignment. Those were not
tested with live writes. Settings rates are labeled **legacy M-PESA rates** in the
admin: WhatsApp orders intentionally use each order's separately agreed quote.

## Repeat the checks

From `backend`:

```sh
python -B manage.py test core orders products --settings=tinahstore.test_settings --noinput
```

The original six failures are retained as regression tests and now all pass.
Step 1 resolved rejected updates/invalid uploads; this follow-up resolves the
remaining stock, visibility and delivery-setting failures.

An optional browser harness exercises the actual admin/storefront production
bundles against a disposable local Django API, not mocked responses. Build both
frontends before running it. On PowerShell, from `backend`:

```powershell
$env:RUN_ADMIN_BROWSER_TESTS = '1'
python -B manage.py test core.test_admin_actions.AdminActionsBrowserTests --settings=tinahstore.test_settings --noinput
Remove-Item Env:RUN_ADMIN_BROWSER_TESTS
```

It requires Node with the experimental WebSocket flag supported (the test launcher
supplies it), and Chrome (`CHROME_PATH` can override the default Windows path).
Backend settings create a private temporary SQLite database for concurrent browser
requests, use in-memory image storage, and force `/media/` URLs instead of a real
CDN origin. Payments and external notifications are disabled.

**Browser scope:** early runs hit shared in-memory SQLite/session interference
and local Node/Chrome memory failures. Those historical runs are not used for the
current sign-off. The latest disposable-file, real-time browser run passes all
14 focused scenarios. The two known product-form scenarios are explicitly skipped
in `catalog-delivery` mode; no passing unfiltered/all-scenarios run is claimed.
