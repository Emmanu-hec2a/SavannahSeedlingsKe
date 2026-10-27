import { useEffect } from 'react';

// Content is visible before, during and without JS. No hidden/pending classes,
// layout changes, scroll handlers or motion library.
export function useSectionReveals(rootRef, refreshKey) {
  useEffect(() => {
    const root = rootRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
    const animations = new Map();
    const seen = new WeakSet();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (motion.matches || entry.target.contains(document.activeElement)) return;
        const fadeOnly = entry.target.dataset.reveal === 'fade';
        const opacity = Number(window.getComputedStyle(entry.target).opacity);
        const frames = fadeOnly ? [
          { opacity: 0 },
          { opacity },
        ] : [
          { opacity: 0.65 * opacity, transform: 'translateY(12px)' },
          { opacity, transform: 'translateY(0)' },
        ];
        const animation = entry.target.animate(frames, {
          duration: fadeOnly ? 600 : 420,
          easing: 'cubic-bezier(.2,.7,.3,1)',
        });
        animations.set(entry.target, animation);
        animation.onfinish = animation.oncancel = () => animations.delete(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    const register = node => {
      const observe = element => {
        if (seen.has(element)) return;
        seen.add(element);
        observer.observe(element);
      };
      if (node.matches?.('[data-reveal]')) observe(node);
      node.querySelectorAll?.('[data-reveal]').forEach(observe);
    };
    register(root);
    // Products and nursery photos arrive asynchronously. Observe their own cards
    // when inserted, rather than revealing a tall mobile section all at once.
    const mutations = 'MutationObserver' in window ? new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(register));
    }) : null;
    mutations?.observe(root, { childList: true, subtree: true });
    const stopFocusedReveal = event => {
      animations.forEach((animation, element) => {
        if (element.contains(event.target)) animation.cancel();
      });
    };
    const stopMotion = () => {
      if (motion.matches) animations.forEach(animation => animation.cancel());
    };
    motion.addEventListener('change', stopMotion);
    root.addEventListener('focusin', stopFocusedReveal);
    return () => {
      observer.disconnect();
      mutations?.disconnect();
      animations.forEach(animation => animation.cancel());
      motion.removeEventListener('change', stopMotion);
      root.removeEventListener('focusin', stopFocusedReveal);
    };
  }, [rootRef, refreshKey]);
}
