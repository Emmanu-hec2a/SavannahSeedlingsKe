import { getSiteIdentity, getSocialIdentity, siteMetadata } from '../../src/data/siteMetadata.js';

export function siteBrandingPlugin() {
  return {
    name: 'savannah-site-branding',
    transformIndexHtml() {
      const { twitterSite } = getSocialIdentity();
      const meta = (key, content, property = false) => ({
        tag: 'meta',
        attrs: { [property ? 'property' : 'name']: key, content, 'data-site-default': 'true' },
        injectTo: 'head',
      });
      return [
        { tag: 'title', attrs: { 'data-site-default': 'true' }, children: siteMetadata.title, injectTo: 'head' },
        meta('description', siteMetadata.description),
        meta('keywords', siteMetadata.keywords),
        ...Object.entries({
          'og:site_name': siteMetadata.name,
          'og:type': 'website',
          'og:locale': siteMetadata.locale,
          'og:title': siteMetadata.title,
          'og:description': siteMetadata.description,
          'og:image': siteMetadata.image,
          'og:image:width': '1200',
          'og:image:height': '630',
          'og:image:alt': siteMetadata.imageAlt,
        }).map(([key, value]) => meta(key, value, true)),
        ...Object.entries({
          'twitter:card': 'summary_large_image',
          'twitter:title': siteMetadata.title,
          'twitter:description': siteMetadata.description,
          'twitter:image': siteMetadata.image,
          'twitter:image:alt': siteMetadata.imageAlt,
          ...(twitterSite ? { 'twitter:site': twitterSite } : {}),
        }).map(([key, value]) => meta(key, value)),
        {
          tag: 'script',
          attrs: { id: 'site-identity', type: 'application/ld+json' },
          // This is permanent site identity, not per-page Helmet data. Escaping
          // '<' also prevents a future configured value closing the script tag.
          children: JSON.stringify(getSiteIdentity()).replace(/</g, '\\u003c'),
          injectTo: 'head',
        },
      ];
      // Do not put a homepage canonical or og:url in the shared SPA shell:
      // direct product/shop requests must not initially point to the homepage.
    },
  };
}
