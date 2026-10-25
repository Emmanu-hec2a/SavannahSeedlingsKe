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
