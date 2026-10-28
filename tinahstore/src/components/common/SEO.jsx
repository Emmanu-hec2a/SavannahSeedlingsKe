import { Helmet } from 'react-helmet-async';

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
  const siteName = 'Savannah Seedlings';
  const defaultDescription = 'Seeding Africa for Sustainable fruit farming. Premium certified grafted fruit seedlings in Kenya including Hass Avocado, Pixie Orange, Kent Mango & Yellow Passion.';
  const defaultKeywords = 'grafted seedlings Kenya, Hass Avocado seedlings, Pixie Orange seedlings, fruit seedlings Nairobi, Muranga nursery, Savannah Seedlings';
  const defaultImage = 'https://savannahseedlings.co.ke/og-image.png';
  const siteUrl = 'https://savannahseedlings.co.ke';

  const fullTitle = title ? `${title} | ${siteName}` : `Savannah Seedlings | Seeding Africa for Sustainable fruit farming`;
  const metaDescription = description || defaultDescription;
  const metaKeywords = keywords || defaultKeywords;
  const metaImage = image || defaultImage;
  const metaUrl = url ? `${siteUrl}${url}` : siteUrl;

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
      <meta property="og:url" content={metaUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={metaUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />

      {/* Structured Data */}
      {schemaData && (
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      )}
    </Helmet>
  );
}
