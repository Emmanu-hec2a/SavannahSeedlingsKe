// Shared by the HTML build and React so crawler and browser branding agree.
export const siteMetadata = {
  name: 'Savannah Seedlings',
  url: 'https://savannahseedlings.com',
  title: 'Savannah Seedlings | Seeding Africa for Sustainable fruit farming',
  description: 'Seeding Africa for Sustainable fruit farming. Premium certified grafted fruit seedlings in Kenya including Hass Avocado, Pixie Orange, Kent Mango & Yellow Passion.',
  keywords: 'grafted seedlings Kenya, Hass Avocado seedlings, Pixie Orange seedlings, fruit seedlings Nairobi, Muranga nursery, Savannah Seedlings',
  image: 'https://savannahseedlings.com/og-image.png',
  imageAlt: 'Savannah Seedlings — Seeding Africa for Sustainable fruit farming, with a seedling illustration.',
  locale: 'en_KE',
};

// Add only confirmed, official business profile URLs, not platform homepages or
// guessed handles. These populate Organization.sameAs; X also adds twitter:site.
export const socialProfiles = {
  facebook: '',
  instagram: '',
  tiktok: '',
  x: '',
  youtube: '',
  linkedin: '',
  threads: '',
};

const socialHosts = {
  facebook: ['facebook.com'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  x: ['x.com', 'twitter.com'],
  youtube: ['youtube.com'],
  linkedin: ['linkedin.com'],
  threads: ['threads.net', 'threads.com'],
};

export function getSocialIdentity(profiles = socialProfiles) {
  const sameAs = [];
  let twitterSite;
  for (const [platform, value] of Object.entries(profiles)) {
    if (!value?.trim()) continue;
    const profile = new URL(value.trim());
    const host = profile.hostname.replace(/^www\./, '');
    if (profile.protocol !== 'https:' || profile.username || profile.password || profile.port ||
        !socialHosts[platform]?.includes(host) || profile.pathname === '/' || profile.hash) {
      throw new Error(`Use a full, official HTTPS ${platform} profile URL in siteMetadata.js.`);
    }
    if (platform === 'x') {
      const handle = profile.pathname.replace(/\/$/, '').slice(1);
      if (!/^[A-Za-z0-9_]{1,15}$/.test(handle) || /^(home|intent|share|search|explore|i)$/i.test(handle)) {
        throw new Error('Use the X account profile URL, not a post or sharing link.');
      }
      twitterSite = `@${handle}`;
    }
    sameAs.push(profile.href);
  }
  return { sameAs: [...new Set(sameAs)], twitterSite };
}

export function getSiteIdentity(profiles = socialProfiles) {
  const { sameAs } = getSocialIdentity(profiles);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteMetadata.url}/#website`,
        name: siteMetadata.name,
        url: `${siteMetadata.url}/`,
        publisher: { '@id': `${siteMetadata.url}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${siteMetadata.url}/#organization`,
        name: siteMetadata.name,
        url: `${siteMetadata.url}/`,
        logo: `${siteMetadata.url}/logo_seal.png`,
        ...(sameAs.length ? { sameAs } : {}),
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+254-710-583-989',
          contactType: 'customer service',
          areaServed: 'KE',
          availableLanguage: 'en',
        },
      },
    ],
  };
}
