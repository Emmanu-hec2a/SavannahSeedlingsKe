import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';

export default function NurseryGallery() {
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.listNurseryPhotos().then(data => {
      if (!cancelled && Array.isArray(data)) setPhotos(data);
    }).catch(() => {
      // This enhancement must never block the nursery text or its illustration.
    });
    return () => { cancelled = true; };
  }, []);

  if (!photos.length) return null;
  return (
    <div className="nursery-gallery" aria-labelledby="nursery-gallery-title">
      <div className="section-head" data-reveal="fade">
        <div><p className="eyebrow">From Our Nurseries</p><h3 id="nursery-gallery-title" className="h2">Where healthy seedlings begin.</h3></div>
      </div>
      <div className="nursery-photo-grid">
        {photos.map((photo, index) => (
          <figure key={photo.id} className={`nursery-photo${index === 0 && photo.is_featured ? ' nursery-photo-featured' : ''}`} data-reveal="fade">
            <img src={photo.image} alt={photo.alt_text} width="800" height="600" loading="lazy" decoding="async" />
            {photo.caption && <figcaption>{photo.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}
