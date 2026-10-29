import { Helmet } from 'react-helmet-async';
import { useLayoutEffect } from 'react';
import { getSocialIdentity, siteMetadata } from '../../data/siteMetadata.js';

export default function SEO({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  noIndex = false,
  schemaData
}) {
  // React 19 hoists Helmet's tags but does not deduplicate against the static
  // HTML shell. Only withdraw our own defaults, before paint, while this page
  // owns metadata. Restore them when navigating to a page without an SEO owner.
  // The persistent site-identity JSON-LD and favicon links are never touched.
  useLayoutEffect(() => {
    const defaults = [...document.head.querySelectorAll('[data-site-default]')];
    defaults.forEach(node => node.remove());
    return () => defaults.forEach(node => document.head.appendChild(node));
  }, []);

  const { name: siteName, description: defaultDescription, keywords: defaultKeywords, image: defaultImage, url: siteUrl } = siteMetadata;
  const { twitterSite } = getSocialIdentity();

  const fullTitle = title ? `${title} | ${siteName}` : siteMetadata.title;
  const metaDescription = description || defaultDescription;
  const metaKeywords = keywords || defaultKeywords;
  const metaImage = image || defaultImage;
  const metaUrl = url ? `${siteUrl}${url}` : siteUrl;
  const imageAlt = image ? fullTitle : siteMetadata.imageAlt;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={metaKeywords} />
      {noIndex && <meta name="robots" content="noindex,follow" />}
      <link rel="canonical" href={metaUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={siteMetadata.locale} />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:image:alt" content={imageAlt} />
      {!image && <meta property="og:image:width" content="1200" />}
      {!image && <meta property="og:image:height" content="630" />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {twitterSite && <meta name="twitter:site" content={twitterSite} />}
      <meta name="twitter:url" content={metaUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {/* Structured Data */}
      {schemaData && (
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      )}
    </Helmet>
  );
}
