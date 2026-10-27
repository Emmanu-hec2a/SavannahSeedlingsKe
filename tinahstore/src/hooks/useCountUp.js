import { useLayoutEffect, useState } from 'react';

const numberFormat = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

// Start on viewport entry, once per mount. Unsupported motion APIs and reduced
// motion keep the final value readable instead of leaving a counter at zero.
export function useCountUp(valueRef, finalValue, duration = 1400) {
  const [display, setDisplay] = useState(finalValue);

  useLayoutEffect(() => {
    const node = valueRef.current;
    const match = /^(\d[\d,]*)(\+?)$/.exec(finalValue);
    const target = match ? Number(match[1].replaceAll(',', '')) : NaN;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!node || !Number.isSafeInteger(target) || target < 1 || duration <= 0 ||
        !motion || motion.matches || !motion.addEventListener ||
        !window.IntersectionObserver || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
      setDisplay(finalValue);
      return;
    }

    let active = true;
    let started = false;
    let finished = false;
    let frame = null;
    let startTime;
    const format = value => numberFormat.format(value) + match[2];
    const finish = () => {
      finished = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      observer.disconnect();
      setDisplay(finalValue);
    };
    const tick = time => {
      if (!active || finished) return;
      if (startTime === undefined) startTime = time;
      const progress = Math.min(1, Math.max(0, (time - startTime) / duration));
      if (progress === 1) { finish(); return; }
      setDisplay(format(Math.floor(target * (1 - (1 - progress) ** 3))));
      frame = window.requestAnimationFrame(tick);
    };
    const observer = new window.IntersectionObserver(entries => {
      if (!active || started || finished || !entries.some(entry => entry.isIntersecting)) return;
      started = true;
      observer.disconnect();
      frame = window.requestAnimationFrame(tick);
    }, { threshold: 0.2 });
    const onMotionChange = () => { if (active && motion.matches) finish(); };

    setDisplay(format(0));
    motion.addEventListener('change', onMotionChange);
    observer.observe(node);
    return () => {
      active = false;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      motion.removeEventListener('change', onMotionChange);
    };
  }, [valueRef, finalValue, duration]);

  return display;
}
