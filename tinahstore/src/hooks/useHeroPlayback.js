import { useEffect, useState } from 'react';

export const HERO_ROTATION_QUERY = '(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export function useHeroPlayback(heroRef) {
  const [eligible, setEligible] = useState(false);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(true);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const media = window.matchMedia(HERO_ROTATION_QUERY);
    const connection = navigator.connection;
    const updateEligibility = () => setEligible(media.matches && !connection?.saveData && 'IntersectionObserver' in window);
    const updateVisibility = () => setForeground(!document.hidden);
    updateEligibility();
    updateVisibility();
    media.addEventListener('change', updateEligibility);
    connection?.addEventListener?.('change', updateEligibility);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting));
    }) : null;
    observer?.observe(hero);
    return () => {
      observer?.disconnect();
      media.removeEventListener('change', updateEligibility);
      connection?.removeEventListener?.('change', updateEligibility);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [heroRef]);

  return { eligible, playing: eligible && visible && foreground };
}
