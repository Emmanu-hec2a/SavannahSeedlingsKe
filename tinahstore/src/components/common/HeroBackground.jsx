import { useEffect, useState } from 'react';
import { useHeroPlayback } from '../../hooks/useHeroPlayback.js';

// Fixed stock photographs, separate from the admin-managed nursery gallery.
// Sources and license details: HERO_PHOTO_CREDITS.md.
export const HERO_PHOTOS = [
  '/images/hero/nursery-wide.webp',
  '/images/hero/citrus-seedling.webp',
  '/images/hero/potted-seedlings.webp',
];

export default function HeroBackground({ heroRef }) {
  const { eligible, playing } = useHeroPlayback(heroRef);
  const [primaryReady, setPrimaryReady] = useState(false);
  const [loaded, setLoaded] = useState({});
  const [failed, setFailed] = useState(false);
  const loadExtras = eligible && primaryReady && !failed;
  const ready = loadExtras && loaded[1] && loaded[2];

  useEffect(() => { if (!eligible) setLoaded({}); }, [eligible]);

  return (
    <div className={`hero-background${ready ? ' is-ready' : ''}${playing ? ' is-playing' : ''}`} aria-hidden="true">
      <picture className="hero-photo-base">
        <source media="(max-width: 900px)" srcSet="/images/hero/nursery-mobile.webp" />
        <img src={HERO_PHOTOS[0]} alt="" width="1600" height="1000" fetchPriority="high" loading="eager" decoding="async"
          onLoad={() => setPrimaryReady(true)} onError={() => setFailed(true)} />
      </picture>
      {loadExtras && <>
        {ready && <img src={HERO_PHOTOS[0]} alt="" className="hero-photo-slide" width="1600" height="1000" decoding="async" style={{ animationDelay: '0s' }} />}
        {HERO_PHOTOS.slice(1).map((src, index) => (
          <img key={src} src={src} alt="" className="hero-photo-slide" width="1600" height="1000" decoding="async" fetchPriority="low"
            style={{ animationDelay: `${(index + 1) * 6}s` }}
            onLoad={() => setLoaded(current => ({ ...current, [index + 1]: true }))}
            onError={() => setFailed(true)} />
        ))}
      </>}
    </div>
  );
}
