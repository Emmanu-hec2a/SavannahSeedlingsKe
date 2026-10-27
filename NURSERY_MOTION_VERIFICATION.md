# Nursery photos and gentle motion

Current hero: the later **Photographic hero** section below supersedes the original
leaf-sway/illustration design and the earlier memory-blocked build notes. The
latest storefront production build, 10 hero browser scenarios, 12 scroll-fade
logic checks and 30 real-API cross-app browser checks pass. The cross-app run was
confirmed on 2026-10-27; two pre-existing unrelated product-form cases remain
explicitly skipped. Nothing has been deployed.

Implemented locally on 2026-10-26. Nothing has been deployed, and no real photos,
accounts, orders or storage objects were changed during verification.

## Storefront

- Only the hero leaves sway. The stem, soil, certification tag, logo and navigation
  stay still. The decorative sway runs once for 4.6 seconds, then stops.
- Hero copy and CTAs have a short entrance; links remain usable throughout.
- Homepage headings, individual cards/content blocks and nursery photos fade once
  on entry. The IntersectionObserver enhancement uses opacity only; content is never
  hidden awaiting JavaScript or an observer callback.
- Reduced-motion preferences disable the new motion, including section reveals.
- Desktop product images have a small hover zoom. Wishlist state is accessible
  through `aria-pressed`; cart/wishlist count badges acknowledge increases without
  moving the header or floating controls. Checkout layout/behavior is unchanged.
- Existing section padding, hero padding, CTA margins and hero grid gaps are
  unchanged. The optional nursery gallery has its own 64px/48px top separation,
  24px card gaps and reserved 4:3 image space. It uses three/two/one columns.
- Nursery photos appear below the existing nursery story; there is no autoplay
  carousel. Empty/failed photo requests leave the existing story/illustration in
  place, with no empty gallery section.

## Admin: Nursery Photos

Open `/nursery-photos` using the sidebar. Staff can upload, preview, replace,
caption, describe, feature, hide, republish and remove photos. Change Display order
and save to reorder: featured first, then ascending number, then stable ID.

Uploads support JPEG/PNG/WebP up to 5 MB. The server validates and decodes files,
corrects EXIF orientation, caps dimensions at 1600px, compresses to JPEG and strips
EXIF/location metadata. No new application dependencies were added.

Failed edits retain the form draft. Refresh photos reloads only the list, not the
draft. Switching edits/cancelling a draft prompts for confirmation. Permanent
removal requires confirmation; hiding is available for reversible removal from
the homepage.

## Backend and saved-data protection

New API: `/api/v1/nursery-photos/` and `/api/v1/nursery-photos/<id>/`.
Public/customer reads include published photos only; all writes require staff.
Staff can read hidden photos. Lists are uncached so fresh homepage visits read
the current saved state. Already-open storefront tabs do not receive live pushes.

Photo/metadata writes and featured selection are transactional. Fresh UUID storage
keys prevent a replacement from overwriting the original. Failed requests attempt
cleanup of newly written files; old files are removed only after successful commit.
Updates/deletes select the photo for a database row lock (effective on production
PostgreSQL; SQLite tests assert the lock is requested but do not prove concurrency).
The database enforces at most one featured photo. Hidden photos are excluded from
the public list regardless of their featured flag.

Storage is not transactional: a provider outage or process crash may leave orphan
files. Cleanup errors log the precise key for an operator to retry. This is not a
durable background cleanup queue. Hiding a photo removes it from public API reads,
but cannot revoke a previously shared/cached media URL.

## Verification

Use isolated test settings only:

```powershell
# From backend; 95 tests pass, one opt-in browser test is skipped.
python -B manage.py test core orders products --settings=tinahstore.test_settings --noinput
python -B manage.py makemigrations --check --dry-run --settings=tinahstore.test_settings

# Real local API, disposable SQLite/media, production frontend bundles and Chrome.
$env:RUN_ADMIN_BROWSER_TESTS='1'
$env:ADMIN_ACTIONS_FOCUS='nursery-motion'
python -B manage.py test core.test_admin_actions.AdminActionsBrowserTests --settings=tinahstore.test_settings --noinput
```

The nursery backend adds 14 tests: authorization, active visibility, ordering,
feature switching, bounds/formats, orientation/metadata, compression, replacement,
write-then-raise storage failures, database/serialization rollback, commit-time
deletion and cleanup outages.

The focused cross-app browser run passes 28 checks covering nursery publishing and photo loading,
mobile admin controls, retained drafts, feature/hide/republish/remove, rejected
replacement, spacing at 320/390/768/1280px, both storefront themes, leaf-only finite
motion, badge feedback, once-only reveals, reduced motion, missing observer support
and API outages. It also reruns existing product/stock/visibility, delivery-setting
and password/session flows. Two pre-existing unrelated product-form cases remain
explicitly skipped: clearing Original Price and removing product images. Nursery
photo replacement/deletion is separate and tested.

Both production builds pass. Existing admin authentication/browser smoke checks
pass (20); existing storefront account/Google checks pass (17). These are local
checks, not a live Railway/R2/Cloudflare deployment test or a full checkout audit.
The existing advisory admin bundle-size warning remains.

## Deployment

1. Deploy the backend including `core/migrations/0002_nurseryphoto.py`, and run
   `python manage.py migrate`. The existing Railway startup command already runs
   migrations before Gunicorn; confirm that this migration applies in the log.
2. Deploy the rebuilt admin and storefront using their existing API variables.
3. Sign in to the admin, open Nursery Photos, and upload real nursery photographs.
   Fill in meaningful descriptions, save captions/order, then check a fresh
   homepage visit. No sample photography is published by this change.

No dependency upgrade, credential change or manual live database modification is
required beyond the additive migration. Deploying the storefront before the API
will keep the illustration fallback, but its photo-management API will not work
until the backend/migration is deployed.

## Follow-up: footer fade-in

The full footer's main content and copyright row now fade from opacity 0 to 1
over 600ms when they enter the viewport. Each runs once per footer mount, with no
translation, layout change or persistent hidden state. Reduced motion and missing
observer support keep the content immediately visible. The compact checkout footer
is unchanged. This frontend-only follow-up requires no additional migration.

The footer-only revision's storefront production build passed. A footer fade regression scenario
was added to the browser harness, but its execution could not complete: retries
encountered a Chrome debugging timeout and then a fatal JavaScript out-of-memory
startup error. The 28 passing cross-app checks above describe the prior verified
version; they do not claim browser verification of this footer follow-up.

## Clarification: progressive fades through the homepage

The requested scroll reveal is now applied from below the hero through to the
bottom, not only the footer. Delivery highlights, category headings/cards,
featured-product heading/cards, nursery content/photos, testimonial heading/cards,
contact content/cards, newsletter and footer use 600ms opacity-only fades.
Each block reveals on its own entry, once, instead of a whole tall mobile section
revealing when only its heading is visible. Hero entrance/leaf motion remains.

The hook observes newly inserted product/photo cards with a MutationObserver.
Nursery photos now use the homepage's observer to avoid duplicate animations.
Content stays visible without observer/animation APIs; reduced motion skips fades,
and keyboard focus cancels an active fade immediately. Existing padding, grid gaps,
header/navigation and compact checkout footer are unchanged.

Added `npm run test:motion` for 11 lightweight tests of the real hook with DOM and
observer stand-ins. Node startup failed locally due to sandbox path permissions
and then out-of-memory errors. The same 11 test bodies were successfully executed
against the actual hook source in the isolated V8 tool runtime. These verify fade
keyframes/timing, entry triggering, once-only behavior, independent late-loaded
cards, duplicate-registration protection, reduced-motion cancellation, focus,
unsupported APIs and cleanup. This is logic verification, not browser rendering.

During that earlier attempt, the production build could not complete: the local esbuild helper
failed allocating memory and an unsandboxed retry failed during Node startup.
At that point `dist` was still the earlier footer-only build. This limitation is
now resolved: the photographic-hero build and the later integration run below
include the page-wide reveals and their per-card browser scenario.

## Photographic hero

The homepage hero now uses three hardcoded, locally served Unsplash photographs
instead of its illustration. The admin-managed nursery gallery is unchanged.
The photos are illustrative stock, not represented as the nursery's own photos.
See [photographer/source/license credits](tinahstore/HERO_PHOTO_CREDITS.md).

- Each image enters at a 6-second interval, with an approximately 800ms crossfade
  in an 18-second CSS cycle. The outgoing image remains behind the incoming one
  until the fade completes, including the last-to-first transition.
- Hover anywhere in the hero or keyboard-focus its CTA links to pause immediately
  at the current animation position. Leaving/resuming focus resumes the cycle.
  There are no slideshow buttons, dots, arrows or click-to-advance behavior.
- Touchscreens, widths up to 900px, reduced-motion users and Save-Data users get
  a static first photo. Missing observer support also falls back to static.
- The first image is prioritized. Extra photographs load only after the first is
  ready on eligible devices; the slideshow waits for both additional images.
  A failed extra image leaves the first photo; a failed first image leaves a dark
  green background and usable text/links. The animation pauses offscreen and in
  background tabs.
- The headline and CTAs are stationary. A dark green overlay and local hero-only
  colors keep them readable in both themes. Header, other sections, existing hero
  padding and CTA margins are unchanged. The text area has a 440px desktop/520px
  narrow-screen minimum height rather than leaving an empty illustration column.
- Four optimized WebP files total approximately 637 KiB: three 1600×1000 photos
  and a 720×1000 mobile crop. The mobile crop alone is approximately 77 KiB. No
  third-party image request, image API, new package or backend migration is added.

Latest verification:

```powershell
# From tinahstore
npm run build
npm run test:motion
npm run test:hero
```

The build and 12 scroll-reveal logic checks now execute successfully in Node.
The 10 production-bundle hero browser scenarios pass: local photo sources and
timing, mid-fade compositing and wraparound, hover/focus pause and resume,
offscreen pause, static mobile at 320/390/768px without downloading extra slides,
wide-touch static behavior, reduced motion and both primary/secondary image
failures. Desktop/mobile screenshots were visually inspected. Test APIs are local
fixtures; no real account/backend/storage is used by `test:hero`.

On 2026-10-27 the full `ADMIN_ACTIONS_FOCUS=nursery-motion` real-API run also passed
30 browser checks with no JavaScript errors. This confirms per-card scroll fades,
once-only reveals, the footer fade, both themes, spacing, reduced motion,
unsupported-observer fallback, product uploads/updates/stock/visibility, nursery
publishing, delivery settings and password/session flows against disposable data.
The once-only test now waits for the initial fade to start and finish before
scrolling back; it no longer mistakes a delayed first fade for a replay. Tests
also respect existing design opacity (the copyright row is intentionally muted)
and distinguish hover transitions from the opacity reveal. The reveal hook ends
at each element's designed opacity to avoid a brightness jump on completion.
The two known unrelated product-form defects (clearing Original Price and removing
product images) remain excluded; no new pass is claimed for them.

Deploy the rebuilt storefront to publish this hero. This hero-only change needs
no admin deployment or migration; the earlier nursery gallery still requires its
previously documented backend/admin deployment and migration.
