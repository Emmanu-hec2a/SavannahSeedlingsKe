import Icon from '../icons/Icon.jsx';
import { homeServices, serviceWhatsAppUrl } from '../../data/homeServices.js';

export default function HomeServices() {
  return (
    <section id="services" className="home-services" aria-labelledby="home-services-title">
      <div className="container">
        <div className="section-head services-heading" data-reveal="fade">
          <div>
            <p className="eyebrow">Our services</p>
            <h2 id="home-services-title" className="h2">Expert support for your farm</h2>
            <p className="lede">From understanding your soil to caring for your crops, Savannah Seedlings supports your growing journey.</p>
          </div>
        </div>
        <div className="services-grid">
          {homeServices.map(service => (
            <article className="service-card" key={service.id} aria-labelledby={`service-${service.id}`} data-reveal="fade">
              <div className="service-card-heading">
                <span className="service-icon"><Icon name={service.icon} className="icon icon-lg" /></span>
                <h3 id={`service-${service.id}`}>{service.title}</h3>
              </div>
              <p>{service.description}</p>
              <a
                className="btn btn-outline service-enquiry"
                href={serviceWhatsAppUrl(service.title)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Enquire on WhatsApp about ${service.title.toLowerCase()}`}
              >
                <Icon name="whatsapp" /> Enquire on WhatsApp
              </a>
            </article>
          ))}
        </div>
        <p className="services-note" data-reveal="fade">Provided directly by Savannah Seedlings. Contact our team for pricing and availability.</p>
      </div>
    </section>
  );
}
