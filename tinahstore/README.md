# Savannah Seedlings storefront

Run `npm run dev` for local development and `npm run build` to rebuild `dist/`.

## Optional Google sign-in

Set `VITE_GOOGLE_CLIENT_ID` in the **build environment** to enable Google sign-in.
Leave it empty for email/password authentication only. The `/account` and `/signup`
pages do not require Google configuration. Missing or whitespace-only client IDs
skip the Google SDK and hide its buttons and OR divider. SDK loading and
initialization failures leave the email/password forms available.

For Cloudflare deployments, configure this value before the Vite build, then
rebuild and deploy. A runtime-only Worker binding cannot change an already built
frontend. Also set `VITE_API_BASE_URL` to the production HTTPS API origin or its
complete `/api/v1` URL. Do not deploy the localhost API default to production.
Configure the deployed site's origin in Google's authorized JavaScript origins
when enabling Google sign-in. No redirect-rule changes are needed for this fix.

The rebuilt `dist/` contains the fix, but running a local build does not publish
it to the existing Cloudflare Worker.

## Regression checks

Run `npm run test:auth` with Chrome installed (override `CHROME_PATH` if necessary).
The checks build configured, empty and whitespace-only Google client IDs in
memory and run the production app against mock Google/auth APIs. No real login,
registration or external API writes occur. They cover account/signup rendering,
email flows, session restoration, Google token exchange, SDK failures, popup
errors and client-side navigation. The test builds do not replace `dist/` or edit
your `.env` file.

## Three-photo local nursery demo

This preview uses a separate SQLite database and local media, not the usual
configured database or R2 storage. It is an empty demo catalog with three nursery
stock photographs; it does not copy real products, orders or accounts.

From `backend`:

```powershell
python -B manage.py migrate --settings=tinahstore.demo_settings --noinput
python -B manage.py seed_demo_nursery_photos --settings=tinahstore.demo_settings
python -B manage.py runserver 127.0.0.1:8000 --settings=tinahstore.demo_settings --noreload
```

In another terminal, from `tinahstore`:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Use `VITE_API_BASE_URL=http://127.0.0.1:8000` (the current local setting), then open
`http://127.0.0.1:5173/#about` and scroll to **From Our Nurseries**. There are three
cards, captioned Demo: a nursery growing space, citrus seedling, and potted
seedlings. They use the same credited Unsplash stock sources as the hero, not
photos represented as Savannah's own nursery.

The seeder refuses normal settings and remote storage, and re-running it preserves
existing demo records/edits. Demo data and files live under ignored
`backend/.local-demo/`. Existing `.env` files and production settings are not
changed. Stop the two demo servers and use your normal commands to return to your
usual development database/storage. Do not deploy using `demo_settings`.
