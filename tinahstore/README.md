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

## Homepage stats preview

`src/data/homeStats.js` holds the manually maintained figures and supporting
text. The current configuration is 10,000+ seedlings supplied, 500+ growers
served, 5+ years of experience, and 10+ countries served. The current supporting
copy is the brand tagline. The count-up change preserves these existing edits.
Figures are not derived from business records, inventory, orders, or delivery
destinations; tests verify rendering, not whether the totals are factually true.
Confirm business totals with the seller before presenting them as verified facts.

`HomeStats` sits in the existing trust strip immediately below the hero. It uses
four columns on desktop, two on mobile/tablet, theme colors, and the existing
once-only scroll fades. Each visible number counts up from zero over 1.4 seconds
on first viewport entry, then stays fixed until a new page visit/reload. Its final
width is reserved to prevent movement, and screen readers receive only the final
value. Reduced-motion preferences and missing animation APIs display the final
number immediately. Frame requests and observers are cleaned up on unmount.
It makes no API calls or database changes. Homepage category/product limits
remain four each. Run `npm run test:stats` for the count-up lifecycle checks.

## Homepage services

`HomeServices` renders after Featured Fruit Seedlings and before About Us, with
three services provided directly by Savannah: agronomy support, soil testing,
and irrigation planning, installation, and maintenance. Content lives in
`src/data/homeServices.js`; the section is addressable at `/#services`.

Each card links to Savannah's existing WhatsApp number with a safely encoded,
service-specific enquiry about pricing and availability. Visitors review and
send the draft themselves. There are no automatic messages, service payments,
new API requests, or database changes.

The cards use the existing icon system, theme tokens, section padding, and
per-card fades. Three desktop columns become one column at 900px and below.
Links have service-specific accessible labels, visible keyboard focus, and
touch targets at least 44px high. Reduced-motion and unsupported-observer
fallbacks use the existing section-reveal behavior.

Run `npm run test:services` for the content/link checks. The isolated
`catalog-sync` browser suite also checks placement, accessibility, spacing, and
both themes from 320px through 1280px; it never opens or sends WhatsApp messages.
