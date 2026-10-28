# Mobile navigation and legal-policy review

Implemented locally on 28 October 2026. Nothing has been deployed or sent to
customers. These policy documents are drafts, not a certification of compliance.

## Navigation and pages

- The right-side mobile dialog is 75vw wide, leaving 25% of the viewport showing
  a dimmed 6px-blurred backdrop (including the WebKit prefix).
- Existing close-button, backdrop and Escape dismissal, body scroll locking,
  desktop-resize dismissal and modal semantics remain. Tab boundaries are
  explicitly wrapped inside the dialog. Narrow menu content scrolls independently.
- Our Services links to `/#services`. Anchor scrolling waits for the catalogue
  layout and dialog cleanup and retains room for the sticky header.
- `/privacy-policy` and `/terms-of-service` are standalone frontend routes with
  dated content, contents links, contact details, readable mobile layouts and
  print styles. Their visible review notice and `noindex,follow` metadata remain
  until the owner approves final text.
- Policies are linked in the menu, full footer, checkout footer, signup and
  checkout. Policy links near forms and in signup/checkout footers open separately
  to preserve entered data. No new mandatory checkbox or consent record was added.

## Must be confirmed by the owner / qualified Kenyan legal reviewer

1. The legal entity or individual behind the Savannah Seedlings trading name,
   its required business identifiers, full contact address and any applicable
   data-controller/processor registration or privacy contact requirements.
2. Actual cancellation, returns, replacement, refund and service booking terms.
   No arbitrary deadline, blanket no-refund rule, yield guarantee, liability cap,
   automatic service booking or waiver of mandatory consumer rights was invented.
3. Retention periods, deletion/access-request procedures, backups and security
   arrangements. The website does not currently provide an automatic account or
   transaction erasure workflow, and the draft does not promise immediate erasure.
4. Provider agreements, deployment locations and cross-border safeguards. The
   source includes Cloudflare/Railway infrastructure, Google fonts and optional
   Google sign-in, WhatsApp handoff and optional Telegram staff alerts. A saved
   order may trigger alerts with personal/delivery data before a customer sends
   the WhatsApp message. Do not assume a message is only shared after Send.
5. Whether any additional analytics, advertising, cookies, marketing systems or
   operational data-sharing have been added outside this repository. The current
   homepage newsletter only displays local confirmation; it does not subscribe an
   address through a backend. This task did not silently implement a mailing list.
6. Any additional jurisdictional, plant-delivery or service-specific obligations.
   These drafts are not exhaustive legal advice. Review how agreement disclosure,
   copies and acceptance should work; displaying policy links is not evidence that
   a customer accepted a particular policy version or consented to marketing.

After approval, update `tinahstore/src/data/legalPolicies.js`, the visible draft
notice in `LegalPage.jsx` and its draft-only `noIndex` setting together. Do not
remove the review flag while leaving unresolved business/data-handling claims.

## Sources consulted

- [ODPC's Kenyan data-protection regulatory framework](https://www.odpc.go.ke/data-protection-laws-kenya/).
- [Data Protection Act 2019, official copy hosted by KDIC](https://kdic.go.ke/sites/default/files/2021-07/TheDataProtectionAct__No24of2019.pdf),
  particularly personal-data principles, rights and notification/processing duties.
- [Consumer Protection Act 2012, official Parliament publication](https://www.parliament.go.ke/sites/default/files/2017-05/ConsumerProtectionActNo46of2012.pdf),
  particularly consumer remedies and internet-agreement disclosure. A legal
  reviewer should check current consolidated legislation and applicable regulations.

No statute text was copied into the website; the pages describe the inspected
implementation and proposed business processes in original plain-language drafts.

## Repeat verification

From `tinahstore`, run `npm run build` and `npm run test:legal`. From `backend`:

```powershell
$env:RUN_ADMIN_BROWSER_TESTS='1'
$env:ADMIN_ACTIONS_FOCUS='navigation-legal'
python -B manage.py test core.test_admin_actions.AdminActionsBrowserTests --settings=tinahstore.test_settings --noinput
```

This uses a private headless browser, loopback-only QA proxy, disposable local
database and test storage. It checks drawer geometry, keyboard/pointer closing,
services jumps, policy routes, form-safe links, themes and printing. It does not
validate production hosting, actual legal compliance, or collect customer data.

## Verification results — 28 October 2026

- Storefront production build: passed (Vite 7.3.5).
- `npm run test:legal`: five document-structure/code-alignment checks passed.
- `navigation-legal` browser focus: all eight checks passed, covering 320–900px
  drawer widths, both themes, pointer/Escape/keyboard behavior, repeat services
  navigation, direct policy routes, form-safe links and print output.
- Existing `catalog-sync` browser focus: all 30 checks passed, including admin to
  storefront product/category updates, stock, homepage limits, counters and service
  layout. The two reported HTTP 503 responses were deliberately injected by its
  error/retry tests; both recovery checks passed. No browser script errors occurred.
- Menu and policy screenshots were visually reviewed. `git diff --check` passed.
- These were local checks using disposable data, not production verification.
