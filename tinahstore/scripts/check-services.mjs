import assert from 'node:assert/strict';
import { homeServices, serviceWhatsAppUrl } from '../src/data/homeServices.js';
import { iconPaths } from '../src/components/icons/iconPaths.js';

assert.deepEqual(homeServices.map(service => service.title), ['Agronomy support', 'Soil testing', 'Irrigation services']);
assert.equal(new Set(homeServices.map(service => service.id)).size, 3);
console.log('PASS three distinct approved services');

for (const service of homeServices) {
  assert.ok(service.description.trim());
  assert.ok(iconPaths[service.icon], 'Missing icon for ' + service.title);
  const url = new URL(serviceWhatsAppUrl(service.title));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/254710583989');
  const message = url.searchParams.get('text');
  assert.ok(message.includes(service.title.toLowerCase()));
  assert.ok(message.includes('availability and pricing'));
  assert.equal([...url.searchParams].length, 1);
}
console.log('PASS service icons and unique correctly addressed WhatsApp drafts');

const irrigation = homeServices.find(service => service.id === 'irrigation-services');
for (const scope of ['Planning', 'installation', 'maintenance']) assert.ok(irrigation.description.includes(scope));
console.log('PASS irrigation includes planning, installation and maintenance');

const special = new URL(serviceWhatsAppUrl('Soil & water testing'));
assert.ok(special.searchParams.get('text').includes('soil & water testing'));
assert.equal([...special.searchParams].length, 1);
console.log('PASS service names are safely encoded in message text');
console.log('4 service checks passed; no messages or network requests sent.');
