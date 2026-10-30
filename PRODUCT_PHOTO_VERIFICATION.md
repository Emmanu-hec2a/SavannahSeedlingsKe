# Product photo selection and staged removal

Implemented locally on 30 October 2026. No production products, files, accounts,
credentials or deployments were changed.

## User workflow

- On Add/Edit Seedling, each photo has visible Make primary and Remove buttons.
  The chosen photo has a Primary badge. Controls are not hover-dependent and
  have 44px minimum touch height.
- Uploads, primary choices and removals remain staged until Save. Pending removal
  counts remain visible even when all photos have been removed from the form.
  Discard Changes before saving leaves the backend untouched.
- Removing the primary promotes the first remaining photo. Removing the last
  photo is allowed and returns the storefront's existing placeholder.
- During saves, photo controls and Discard are disabled and a ref guard prevents
  duplicate submissions. Failed validation keeps form values and staged changes.
  Upload validation errors are readable, not raw nested JSON.
- Blob preview URLs are revoked when a staged upload is removed or the form is
  unmounted. The file picker can select the same file again.
- Catalog cards, product detail metadata and the initial gallery selection use
  the same primary photo. Gallery order and the overflow fix are preserved.

## API contract and safety

Product image reads add stable `id` fields; product detail adds `primary_image`.
The existing `is_primary` model field is reused: no schema migration is required.

Multipart saves still upload files using repeated `images` parts. Optional
`image_changes_json` explicitly describes changes. Examples:

```json
{"remove_ids": [123], "primary": {"id": 456}}
```

```json
{"remove_ids": [], "primary": {"upload_index": 0}}
```

Upload indices are zero-based among the new files in the current request, not
among saved photos. `primary: null` is accepted only if no photos will remain.
Omitting `image_changes_json` preserves old clients' append-only behavior. An
omitted saved photo does not imply deletion. `remove_ids` defaults to empty;
omitted primary selection preserves the current primary or chooses a fallback.

- Existing product locks serialize API saves; affected image rows are locked
  during validation. IDs must belong to this product. Stale/foreign IDs, duplicate
  removals, invalid primary choices and missing upload indices return 400 before
  any upload or metadata writes.
- All files are validated before mutations. Product, stock batches, image rows,
  removals and primary flags share the existing save transaction. Failed uploads
  and failures after removal roll back the database and compensate only newly
  uploaded storage keys. Original photos are not deleted on failed saves.
- Old stored files are cleaned up only through a successful commit callback.
  Keys still referenced by another ProductImage are preserved. Storage outages
  during post-commit cleanup are logged with the key for operator retry; the
  already committed save still succeeds. There is no automatic cleanup worker
  or CDN purge in this change.
- Exactly one primary is selected by successful custom-API saves when photos
  remain. Old multiple/zero-primary states normalize on their next save. No bulk
  rewrite of existing products was performed. Django admin inline writes remain
  outside this custom-API normalization; no new database uniqueness constraint
  has been imposed on historical data.

## Verification

Both frontend production builds pass. The admin's existing >500kB chunk warning
is non-fatal; code splitting is outside this photo-management change.

- Full backend suite: 151 discovered, 147 passed, 4 skipped (optional browser and
  PostgreSQL-only concurrency checks), under both the original local Django 4.2.7
  and an isolated Django 5.2.18 installation matching the declared major range.
  Global Python packages and project requirements were not changed.
- The new image-change and existing save-safety modules: 42 tests passed,
  including ownership, rollback, upload errors, shared keys and post-commit cleanup.
- Admin payload/error unit checks: 15 passed.
- Real admin-to-storefront browser focus `product-images`: 12 checks passed with
  disposable SQLite/storage, real local uploads and real staff authentication.
  The final flow passed under both Django 4.2.7 and Django 5.2.18.
  It includes new and saved primary selection, staged removal, Discard, duplicate
  submit protection, failure preservation, mobile controls, primary fallback,
  last-photo removal and storefront synchronization. The invalid-image 400 in
  the report is deliberate.
- Gallery layout/interaction regressions: 9 passed. SEO/navigation: 13 passed.
  Product-copy/purchase-control regressions: 15 passed.
- `makemigrations --check --dry-run` reports no model changes.

Commands (PowerShell, backend commands from `backend`):

```text
python -B manage.py test --settings=tinahstore.test_settings --noinput
$env:RUN_ADMIN_BROWSER_TESTS='1'
$env:ADMIN_ACTIONS_FOCUS='product-images'
python -B manage.py test core.test_admin_actions.AdminActionsBrowserTests --settings=tinahstore.test_settings --noinput
```

From `admin-panel`: `npm run build` and `npm run test:product-images`.
From `tinahstore`: `npm run build`, `npm run test:product-gallery`, `npm run test:seo`.
Optional `NURSERY_QA_SCREENSHOTS=1` retains owned browser review images/profile.
Never point the real-API harness at production; it explicitly requires the
opted-in loopback test server and uses disposable test data.

The existing unrelated original-price-clearing form case remains deferred in
the broader admin-actions harness; the photo-removal case is no longer deferred.

## Rollout

Release the backend first, then the admin panel and storefront. All additions
are backward-compatible for old upload-only clients. A new admin cannot safely
manage old-backend photos without IDs and will block such saves with a reload
message. No new migration, R2 configuration or credentials are required.
Production verification must be coordinated separately.
