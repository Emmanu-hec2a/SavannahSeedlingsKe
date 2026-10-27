# Admin-to-storefront catalog verification

Implemented and verified on 2026-10-27 against the current local source and freshly built admin
and storefront production bundles. This is not a verification of the deployed
Railway/Cloudflare versions or production R2 credentials.

## Safety and scope

- Real admin forms and storefront pages ran in a private headless Chrome session.
- Requests used a disposable local Django LiveServerTestCase database with
  in-memory upload storage and a temporary staff account.
- The browser helper only accepts opted-in loopback test servers. Existing API
  origins in the bundles are redirected to that server by the test harness.
- No production records, ordinary development database, R2 objects, passwords,
  or application configuration were changed. Temporary browser fixtures are not
  saved products in the real catalog.
- The storefront, admin category service, and an additive product serializer
  field were updated. Both production bundles were rebuilt. Nothing was deployed.
- Full test discovery exposed `backend/test_upload.py`, a legacy manual probe
  that tried to upload to an old production endpoint on import. The sandbox
  blocked that connection. An execution guard now prevents reads/uploads during
  import; a regression test verifies this. The manual probe was not executed.

## Results

The original diagnosis found three failures. All three are now fixed.

- Full Django suite: **102 tests, OK, one optional browser test skipped**.
- Focused catalog browser checks: **30 passed**, including the homepage
  four-category/four-product limits, stat counters, and services, with no JavaScript errors.
- Existing nursery/motion/admin browser regression checks: **30 passed**, two
  previously known unrelated product-form checks explicitly skipped.
- Catalog pagination unit checks: **12 passed**.
- Scroll-reveal hook checks: **12 passed**.
- Count-up lifecycle checks: **11 passed**.
- Service content/link checks: **4 passed**, without opening or sending messages.
- Admin and storefront production builds: passed. Admin retains its existing
  large-chunk advisory warning.
- Migration check: no changes detected; this change needs no database migration.
- Desktop/mobile screenshots inspected: existing card spacing and layout retained.

The catalog browser suite intentionally simulates two HTTP 503 responses to test
later-page failure and category retry. Those are expected, not real outages.

| Check | Result |
| --- | --- |
| Staff login through the real admin form | Pass |
| Create a category through admin and read it anonymously from the category API | Pass |
| Show an empty new category in shop filters | Pass |
| Show a new category in homepage category cards | Pass |
| Create an active product with an uploaded image and a stock batch | Pass |
| Show that product, price, and uploaded image in the shop | Pass |
| Show its assigned category and filter the shop by that category | Pass |
| Show initial stock of 17 on the product page | Pass |
| Edit description, price, planting instructions, and stock through admin | Pass |
| Show those updates, including stock of 7, on a freshly loaded product page | Pass |
| Show zero stock as out of stock, not stale legacy stock | Pass |
| Sum two batches, 7 + 5, to 12 in public list/detail responses and product page | Pass |
| Hide a product from the public shop/direct API and restore it on reactivation | Pass |
| Rename a category in admin and show its new name in shop filters/cards/detail | Pass |
| Create a product without batches and show its resulting zero stock | Pass |
| Keep all active products discoverable when the catalog exceeds 12 products | Pass: all 14 test products reachable |
| Category links and search find products beyond the first API page | Pass |
| Later product-page failure does not display a partial catalog as complete | Pass |
| More than 12 categories reach admin list, product form, and shop | Pass: all 14 test categories reachable |
| Homepage limits categories and featured products to four each | Pass: tested with 14 saved entries |
| Hardcoded stats immediately below hero with configured figures and text | Pass: four metrics, including countries served |
| Counters start on entry, settle once, preserve width, and reset on a fresh visit | Pass |
| Reduced motion, runtime preference changes, and missing observers show final values | Pass |
| Category fetch failure has a readable error and a working retry | Pass |
| Layout at 320, 390, 768, and 1280 pixels in both themes | Pass |
| Services after Featured Fruit Seedlings and before About Us | Pass: three approved services |
| Correct service-specific WhatsApp drafts and actual Tab-key focus | Pass: no WhatsApp navigation or messages sent |
| Service cards, section spacing, and touch targets in both themes | Pass: 320, 390, 768, 900, 901, 1024, 1280 pixels |

## Implemented fixes

### 1. Complete catalog pagination

The API still uses page-number pagination with a page size of 12. The storefront
now follows every page before presenting the shop's existing pages of 8. Search,
category counts, and filtering therefore see the full loaded active catalog.

`collectPages` preserves the original filters, accepts paginated/unpaginated
responses, deduplicates repeated IDs, rejects malformed/repeated pagination, and
propagates failures instead of returning partial results. It uses only the next
page number on the original endpoint, never forwarding credentials to a returned
origin. The product hook cancels obsolete requests and resets loading/error state.

The homepage still requests only enough products for its four featured cards;
it does not download the full catalog unnecessarily. Both storefront and admin
category lists follow all category pages, including the product form's selector.

This is an all-pages client-side catalog suitable for the current nursery catalog.
If the catalog grows substantially, move filtering, counts, and search together
to server-side pagination rather than reintroducing first-page-only behavior.

### 2. Admin-managed shop filters

Shop filters now load the category API, including empty categories with a zero
count. Counts reflect all loaded active products, not just the first 12. Category
API failure leaves product-derived options usable and offers an explicit retry.

Category filters use slugs, exposed by an additive read-only `category_slug` field
in the product list serializer. This distinguishes categories with identical
names; the old `category` name field remains unchanged. Name-based resolution
provides compatibility with older API deployments for uniquely named categories.

### 3. Admin-managed homepage category cards

Homepage cards now use saved category names and descriptions, retaining the
existing seedling illustration, card padding, grid gaps, and 4/2/1 responsive
columns. The homepage displays at most **four categories** in the API's existing
alphabetical order, while the shop and admin still load every category. Featured
fruit seedlings remain limited to the **four newest products**. Fewer than four
saved entries display as-is; no fake cards are added. Long text wraps.

Cards link to `/shop?category=<slug>` rather than first-word search queries. The
shop uses URL category/search filters as its source of truth and clears those
parameters when filters are cleared. The browser verified category renaming,
updated links, direct category visits, empty categories, and older products.

Loading, empty, and category-error states are explicit; no hardcoded category
fallback reappears during an API outage. Category retries clear the error state.

### 4. Directly provided farming services

`HomeServices` is a presentational section between Featured Fruit Seedlings and
About Us. It contains agronomy support, soil testing, and irrigation planning,
installation, and maintenance, with the direct-provider wording approved by
the user. Content and enquiry drafts live in `src/data/homeServices.js`.

Each card has a service-specific WhatsApp enquiry to the existing nursery number.
The draft asks about availability and pricing; visitors review/send it themselves.
There is no service checkout, auto-send behavior, new backend endpoint, or saved
customer data. External links use HTTPS, noopener/noreferrer, and accessible names
that retain the visible label and identify the selected service.

The existing icon system gained two code-native icons (flask and droplet). Three
desktop columns stack below 901px; cards retain 24px gaps and existing section
padding. Buttons align across desktop cards and have at least 44px touch targets.
The browser used actual Tab input to verify visible focus and per-card reveal
cancellation on focus. Each card uses the existing fade hook; reduced-motion and
unsupported-observer behavior are inherited. Mobile dark and desktop light
screenshots were inspected. No global section padding or homepage limits changed.

### Stock and refresh behavior

The public list and detail serializers consistently read `available_stock`:
sum the batches when any exist, otherwise use the legacy product stock. Tests
confirmed that zero-stock batches do not fall back to a stale positive stock.
Numeric availability is shown on the product detail page; shop cards currently
do not display a numeric stock quantity.

Checks used fresh navigation/reloads. The storefront fetches on mount; it does
not push or poll admin changes into an already-open unchanged page. Successful
local image uploads do not establish that production R2 credentials work.

## Deployment and remaining boundaries

Stats are manually configured in `tinahstore/src/data/homeStats.js`, not derived
from or verified against business records. That file was subsequently edited to
use 10+ countries served and the brand tagline as supporting text. The count-up
implementation preserves those edits without certifying their factual accuracy.
The tests read configured values instead of restoring older preview figures.
Confirm business totals with the seller before presenting them as verified facts.

The stats extend the existing trust area below the hero; original assurances and
CTA spacing remain intact. Four desktop columns become a 2x2 mobile/tablet grid.
The existing section-reveal hook handles fades and reduced-motion preferences.
Stat values now count up over 1.4 seconds on first viewport entry, once per mount.
The final formatted value reserves the number's width and remains available to
screen readers while intermediate values are aria-hidden. New visits/reloads
restart the counters; scrolling back does not. Reduced motion or unsupported
APIs display final numbers immediately, and switching to reduced motion during
counting completes the values. Observers and pending frames are cleaned up.
The browser harness now fits desktop iframes inside a 1400px headless viewport
so IntersectionObserver is not clipped by the outer test window.
Mobile dark and desktop light screenshots were inspected, and the updated
30-check nursery/motion browser regression run passed (two unrelated skips).

Deploy the backend, storefront, and admin panel to activate all changes in
production. Backend-first is preferred for unambiguous category slugs. There are
no new dependencies, secrets, environment variables, or schema migrations.
The services addition itself only requires a storefront deployment.

These checks do not verify production R2 authentication. Numeric stock is still
shown on product detail, not added to shop cards. The existing price filter is
unchanged. The two unrelated product-form checks (clearing original price and
removing a saved product image) remain excluded from the nursery regression run.

## Reproduce (PowerShell)

Build each app from its directory with `npm run build`, then from `backend`:

```powershell
python -B manage.py test products.test_catalog core.test_admin_actions.AdminActionTests --settings=tinahstore.test_settings --noinput
$env:RUN_ADMIN_BROWSER_TESTS='1'
$env:ADMIN_ACTIONS_FOCUS='catalog-sync'
python -B manage.py test core.test_admin_actions.AdminActionsBrowserTests --settings=tinahstore.test_settings --noinput
```

The focused browser report is printed to the terminal and now runs 30 checks,
including the homepage four-category/four-product limits with 14 saved entries
and the existing smaller-catalog checks. Use `ADMIN_ACTIONS_FOCUS='nursery-motion'` for the existing regression
checks. Run `npm run test:catalog`, `npm run test:stats`, `npm run test:services`, and `npm run test:motion` from `tinahstore` for
the unit checks. Run the full Django suite without the browser opt-in using
`python -B manage.py test --settings=tinahstore.test_settings --noinput`.
