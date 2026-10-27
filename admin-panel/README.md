# Savannah Seedlings admin

## Local sign-in

Start the API from `backend` with `python manage.py runserver`, then run `npm run dev`
from `admin-panel`. Open http://localhost:5174/login. Port 5174 is reserved for the
admin app; the storefront stays on 5173.

Use an existing **active staff** account's Django username and password. The local
staff username is `tinah`; its password has not been changed. Customer accounts
cannot sign into this panel. Django's separate `/admin/` site remains available.

`admin-panel/.env` should contain `VITE_API_URL=http://localhost:8000` locally.
The API also accepts a URL already ending in `/api/v1`.

Set `DJANGO_DEBUG=True` in the local `backend/.env`. This namespaced flag takes
precedence over `DEBUG`, because Windows tools can set an unrelated `DEBUG=release`.
Development explicitly allows the localhost/127.0.0.1 storefront and admin origins.
**Production must use `DJANGO_DEBUG=False` (or omit it and use `DEBUG=False`) and
list the actual HTTPS admin origin in `CORS_ALLOWED_ORIGINS`.** Never deploy the
local `.env` file.

## Authentication

- `POST /api/v1/admin/auth/login/`: username/password; returns staff identity,
  an opaque token and expiry. Login is limited to 10 attempts/minute per IP.
- Send `Authorization: AdminToken <token>` for admin requests.
- `GET /api/v1/admin/auth/me/`: verifies staff status, expiry and identity before
  the app opens protected pages, including after refresh.
- `POST /api/v1/admin/auth/logout/`: revokes the current admin session on the server.
- `POST /api/v1/admin/auth/password/`: validates the current and new passwords,
  then revokes all of that user's admin sessions. Sign in again afterward.

Sessions expire after eight hours (`ADMIN_SESSION_TTL_SECONDS=28800`). Only token
digests are stored in the database. Disabling or demoting staff, or changing their
password through another route, invalidates their admin sessions too.

The browser keeps the token in tab-scoped `sessionStorage`, not persistent
`localStorage`. Old admin localStorage tokens are discarded; sign in once after
upgrading. Customer tokens and customer login endpoints are not changed. Existing
DRF staff tokens retain their backend role permissions for compatibility, but
cannot restore a session in this admin panel.

If the server cannot verify a session, protected pages remain blocked and offer
retry/sign-out. If server logout cannot be confirmed, the browser still clears its
session and warns that the server session remains valid until expiry.

Catalog reads remain public. Product/category writes and storage diagnostics
require staff authorization on the API, not just a frontend route guard.

## Deploy and verify

### Cloudflare Workers

The admin uses Vite **7.3.5** and `@vitejs/plugin-react` **5.2.0**, matching the
storefront's build-tool versions. React 18, React Router 6, Tailwind 3 and the
application's runtime dependencies are unchanged. The Vite configuration explicitly
preserves the previous browser build targets rather than adopting Vite 7's newer
defaults.

Deploy to the existing `savannahseedlingske-admin` Worker using Cloudflare's
automatic Vite configuration, as with the storefront. The earlier hand-written
`wrangler.jsonc` has been removed intentionally; do **not** pass `--config` pointing
to that removed file. Wrangler can generate the Cloudflare Vite integration and
deployment configuration during CI. Generated files such as `dist/wrangler.json`
and `.wrangler/deploy/config.json` are build artifacts, not files to hand-create.

Use these Cloudflare build settings:

- Root directory: `admin-panel`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Use Node.js **22.12 or newer** for the combined build/deploy workflow. Cloudflare's
Node 24 build image is compatible. Local Vite-only builds also support Node 20.19+;
the current Wrangler CLI requires Node 22+, so it cannot run on local Node 20.

Set `VITE_API_URL` to the production **HTTPS backend URL** in Cloudflare's build
environment before building. This value is compiled into the frontend; changing
only a runtime Worker variable will not update an existing build. Add the deployed
admin origin to the backend's `CORS_ALLOWED_ORIGINS` as described above.

Commit the updated `package.json`, `package-lock.json`, Vite configuration and
removal of the old Wrangler file, then start a new Cloudflare deployment from that
commit. CI uses `npm ci`, so the dependency lockfile must be included. Local
verification does not publish the app. On Node 22.12+, Wrangler auto-configuration
can be inspected without deployment using `npx wrangler setup --dry-run`.
The Vite chunk-size warning is advisory and does not fail the build.

References: [Cloudflare automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/),
[Vite 6 migration](https://v6.vite.dev/guide/migration) and
[Vite 7 migration](https://v7.vite.dev/guide/migration).

### Backend and regression checks

Deploy the backend and apply `python manage.py migrate` **before** the rebuilt
admin frontend. The new `core.0001_admin_session` migration has been applied to
the local development database only. Existing account passwords are unchanged.

Run isolated backend checks from `backend`:

```sh
python manage.py test core orders --settings=tinahstore.test_settings --noinput
```

Run browser checks from `admin-panel`:

```sh
npm run test:auth
```

The browser checks use mock APIs, not real staff credentials or customer data.
They require Chrome (set `CHROME_PATH` if it is not at the default Windows path).
They cover direct-route protection, legacy/forged/expired/nonstaff sessions,
refresh, outage/retry, sign-in and logout. They also smoke-test all protected admin
pages, populated dashboard charts, product forms and the WhatsApp delivery quote
form against the production bundle. Backend tests use an isolated in-memory
database and do not call M-PESA, Telegram or external storage.

The login throttle currently uses Django's configured cache; use a shared cache
and gateway-level rate limits for a multi-worker production deployment.

### Admin actions verification

See [the admin-actions verification report](../ADMIN_ACTIONS_VERIFICATION.md) for
real API upload/update, delivery-setting and password-change checks, confirmed
failures, reproduction commands, and the optional cross-app browser harness.
Unlike `test:auth`, that harness uses a disposable real Django API rather than
mock responses. The opt-in `ADMIN_ACTIONS_FOCUS=catalog-delivery` run passes 14
browser checks and explicitly skips the two unrelated, known product-form issues.

The report's Step 1 section documents transactional product saves, image-failure
cleanup and stable batch IDs. Product-save safety checks can be run from `backend`
with `python -B manage.py test products.test_save_safety --settings=tinahstore.test_settings --noinput`.
Delivery-setting saves/validation and storefront stock/visibility regressions are
now fixed. The backend suite passes 81 tests (one opt-in browser test is skipped
by default). Deploy the backend and rebuilt admin frontend; no migration is needed.
Photo removal and clearing Original Price remain separate open product-form issues.

### Nursery Photos and homepage motion

The new **Nursery Photos** sidebar page manages homepage nursery photography:
upload/preview, caption, accessibility description, numeric display order,
featured selection, publish/hide, replacement and confirmed permanent removal.
Uploads are validated and compressed server-side; failed replacements preserve
the saved photo and draft. Refresh photos reloads the list without clearing edits.

This feature adds `core.0002_nurseryphoto`: deploy the backend and run
`python manage.py migrate` before publishing the admin frontend. The earlier
"no migration" note applies only to the stock/visibility/delivery fixes above.
Deploy the storefront too for the gallery and subtle accessible animations.
The current nursery illustration remains until real photos are published.

See [nursery/motion verification and deployment notes](../NURSERY_MOTION_VERIFICATION.md)
for safeguards, local checks and the opt-in `ADMIN_ACTIONS_FOCUS=nursery-motion`
real-API browser run. The expanded isolated backend suite now passes 95 tests,
with one opt-in browser test skipped by default.
