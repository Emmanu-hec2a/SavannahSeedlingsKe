import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/common/SEO.jsx';
import LegalLinks from '../components/common/LegalLinks.jsx';
import { legalPolicies } from '../data/legalPolicies.js';

export default function LegalPage({ kind }) {
  const policy = legalPolicies[kind];
  const titleRef = useRef(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [kind]);

  return (
    <>
      <SEO title={policy.title} description={policy.introduction} url={policy.path} noIndex />
      <main className="container legal-page">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span className="sep">/</span><span className="current">{policy.title}</span></nav>
        <header className="legal-header">
          <p className="eyebrow">Savannah Seedlings</p>
          <h1 ref={titleRef} tabIndex={-1}>{policy.title}</h1>
          <p className="legal-updated">Last updated <time dateTime={policy.dateTime}>{policy.updated}</time></p>
          <p className="lede">{policy.introduction}</p>
          <p className="legal-draft"><strong>Draft for business review.</strong> Savannah should confirm these details and obtain appropriate legal review before treating this as a final policy.</p>
        </header>
        <nav className="legal-toc" aria-label="On this page">
          <h2>On this page</h2>
          <ol>{policy.sections.map(section => <li key={section.id}><a href={`#${kind}-${section.id}`}>{section.title}</a></li>)}</ol>
        </nav>
        <article className="legal-body" aria-label={policy.title}>
          {policy.sections.map(section => (
            <section className="legal-policy-section" id={`${kind}-${section.id}`} key={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              {section.items && <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
              {section.links?.map(link => <p key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a></p>)}
            </section>
          ))}
          <section className="legal-policy-section" id={`${kind}-contact`}>
            <h2>Contact Savannah Seedlings</h2>
            <p>Email <a href="mailto:savannahseedlings@gmail.com">savannahseedlings@gmail.com</a> or call <a href="tel:+254710583989">+254 710 583 989</a>. Our listed nurseries are at Kasarani Kastemil Junction, Nairobi, and Kwa Samaki, Murang'a, along the Nairobi-Nyeri Highway.</p>
          </section>
        </article>
        <div className="legal-related"><LegalLinks /><Link to="/shop">Back to the seedling shop</Link></div>
      </main>
    </>
  );
}
