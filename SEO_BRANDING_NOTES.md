# Search branding and social sharing

Implemented locally on 29 October 2026. No deployment, Search Console submission,
or social account changes were made.

## What changed

- Vite injects the site title, description, Open Graph and X/Twitter card tags,
  and a single WebSite/Organization JSON-LD graph into the initial HTML in both
  development and production. Crawlers do not need to execute React to find it.
- `tinahstore/src/data/siteMetadata.js` is the shared branding source. The existing
  business name, domain and tagline are preserved.
- The persistent site-identity graph replaces the old homepage-only duplicate
  schemas. Per-page Helmet metadata still handles titles, canonical URLs,
  product schemas, product images and legal-page noindex rules. React 19 does not
  deduplicate these tags against static HTML. A layout-effect handoff withdraws
  only our `data-site-default` tags while a page owns SEO metadata and restores
  the defaults on pages without an SEO owner; the site-identity graph stays put.
- The common SPA HTML intentionally has no homepage canonical or `og:url`:
  otherwise a direct product/shop request could initially identify as Home.
  Page-specific URLs continue to be provided by React. This is not a full
  server-rendering/prerendering implementation: non-JavaScript social crawlers
  receive generic brand sharing information, not dynamic product information.
- A simplified favicon uses the existing code-native seedling illustration.
  The full header/footer seal `/logo_seal.png` is unchanged. Actual PNG icon
  dimensions now match the manifest, with a separate Apple touch icon.
- The formerly missing `/og-image.png` now exists as a 1200x630 branded card.
  Source SVGs are retained; `npm run generate:branding` rasterizes them locally
  using Chrome (override `CHROME_PATH` if necessary). PNGs must be committed.
  Cloudflare's normal build does not require Chrome or regenerate the artwork.

## Social account URLs still needed

No confirmed official profile URLs exist in the project. No accounts or handles
have been guessed. Add the business's confirmed full HTTPS URLs to
`socialProfiles` in `tinahstore/src/data/siteMetadata.js` for Facebook, Instagram,
TikTok, X, YouTube, LinkedIn and/or Threads. Leave unused platforms blank.

Configured profiles automatically populate Organization `sameAs` in initial HTML.
The X account also supplies `twitter:site`. Rebuild after changing the config.
Profile URL validation checks formatting/platform, not ownership: confirm the
accounts with Savannah before adding them. Open Graph and Twitter card sharing
metadata works without these links; it does not claim account ownership. There
are no invented TikTok/Instagram tags or Facebook app IDs.

## Verification and release

Run from `tinahstore`:

```text
npm run build
npm run test:seo
```

The SEO check uses only local fixture data and a disposable browser profile. It
checks raw HTML, PNG dimensions, social configuration, JavaScript-disabled
branding, metadata deduplication, product/shop navigation, scoped legal noindex,
and mobile/desktop overflow. No real accounts, orders or API data are touched.

Local verification passed:

- Production build (Vite 7.3.5).
- 13 SEO/branding checks, including disabled-JavaScript and navigation tests.
- 23 customer authentication browser checks with mocked responses.
- 12 catalog pagination checks, 5 legal-document structure checks, and 12
  API-error formatting checks.
- `git diff --check`; no whitespace errors. The stylesheet output is unchanged.

After the storefront is deployed, inspect `https://savannahseedlings.com/` in
Google Search Console using the live URL test. Confirm Google can fetch the
homepage and favicon and request reindexing. Check real sharing previews after
deployment; platforms can cache older images. Google controls the final site
name/favicon and changes can take days to weeks, not necessarily immediately.

Official references:

- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/favicon-in-search
- https://developers.google.com/search/docs/appearance/structured-data/organization
