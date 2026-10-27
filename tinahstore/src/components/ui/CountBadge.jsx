import { useEffect, useRef, useState } from 'react';

export default function CountBadge({ count, className, hideZero = false }) {
  const previous = useRef(count);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (count > previous.current) setPulse(value => value + 1);
    previous.current = count;
  }, [count]);
  if (hideZero && !count) return null;
  return <span key={pulse} className={`${className}${pulse ? ' count-feedback' : ''}`}>{count}</span>;
}
