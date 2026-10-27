# Hero photograph credits

Selected and verified on 2026-10-26. These are illustrative stock photographs,
not photographs of Savannah Seedlings' own nursery or guarantees of stock.
They are hardcoded independently of the admin-managed nursery gallery.

| Local file | Photographer | Original photograph |
| --- | --- | --- |
| `public/images/hero/nursery-wide.webp` | Phil Hearing | [Rows of green plants in a nursery greenhouse](https://unsplash.com/photos/rows-of-green-plants-in-a-nursery-greenhouse-nOHcGgkDJbo) |
| `public/images/hero/nursery-mobile.webp` | Phil Hearing | Smaller portrait crop of the same photograph |
| `public/images/hero/citrus-seedling.webp` | Ksenia Pixelesse | [A young plant sprouts from the ground](https://unsplash.com/photos/a-young-plant-sprouts-from-the-ground-TBjNbj1sdAE) |
| `public/images/hero/potted-seedlings.webp` | James Lo | [Three young plants growing in small pots](https://unsplash.com/photos/three-young-plants-growing-in-small-pots-zERH_HLRDfo) |

All three source pages identify these photographs as free under the
[Unsplash License](https://unsplash.com/license), not Unsplash+ assets. Optimized
WebP copies are served locally: 1600×1000 desktop and 720×1000 for the static
mobile nursery photo. No Unsplash API, random-photo endpoint, API key, runtime
third-party request, or additional image-processing dependency is used.

To replace photos, update `HERO_PHOTOS` in
`src/components/common/HeroBackground.jsx`, the mobile `<source>`, these credits,
and the corresponding local files. Keep three slides unless also adjusting the
18-second CSS cycle and 6-second start delays.
