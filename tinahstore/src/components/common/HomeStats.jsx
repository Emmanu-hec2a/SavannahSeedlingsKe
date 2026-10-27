import { useRef } from 'react';
import { homeStats, homeStatsNotice } from '../../data/homeStats.js';
import { useCountUp } from '../../hooks/useCountUp.js';

function StatValue({ value }) {
  const valueRef = useRef(null);
  const display = useCountUp(valueRef, value);
  return (
    <>
      <span className="sr-only">{value}</span>
      <span ref={valueRef} className="home-stat-value" aria-hidden="true" data-count-target={value}>
        <span className="home-stat-measure">{value}</span>
        <span className="home-stat-count">{display}</span>
      </span>
    </>
  );
}

export default function HomeStats() {
  return (
    <section className="home-stats" aria-labelledby="home-stats-title" aria-describedby="home-stats-notice">
      <div className="home-stats-heading">
        <p className="eyebrow">Our growing community</p>
        <h2 id="home-stats-title">Growing with our farmers</h2>
        <p id="home-stats-notice" className="home-stats-notice">{homeStatsNotice}</p>
      </div>
      <dl className="home-stats-grid">
        {homeStats.map(stat => (
          <div className="home-stat" key={stat.label} data-reveal="fade">
            <dt>{stat.label}</dt>
            <dd><StatValue value={stat.value} /></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
