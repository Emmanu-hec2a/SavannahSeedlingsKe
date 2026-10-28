import assert from 'node:assert/strict';
import { legalPolicies } from '../src/data/legalPolicies.js';

assert.deepEqual(Object.keys(legalPolicies), ['privacy', 'terms']);
assert.equal(legalPolicies.privacy.path, '/privacy-policy');
assert.equal(legalPolicies.terms.path, '/terms-of-service');
console.log('PASS dedicated privacy and terms documents');

for (const policy of Object.values(legalPolicies)) {
  assert.ok(policy.title && policy.introduction && policy.sections.length >= 8);
  assert.equal(policy.dateTime, '2026-10-28');
  assert.equal(new Set(policy.sections.map(section => section.id)).size, policy.sections.length);
  assert.ok(!policy.sections.some(section => section.id === 'contact'));
  for (const section of policy.sections) {
    assert.match(section.id, /^[a-z-]+$/);
    assert.ok(section.title && (section.paragraphs?.length || section.items?.length));
    for (const link of section.links || []) assert.equal(new URL(link.href).protocol, 'https:');
  }
}
console.log('PASS dated documents with unique stable section anchors and safe links');

const privacy = legalPolicies.privacy.sections.flatMap(section => [...(section.paragraphs || []), ...(section.items || [])]).join(' ');
for (const disclosure of ['before WhatsApp opens', 'Tab-session storage', 'Telegram', 'Google', 'Cloudflare', 'Railway', 'does not request automatic GPS access']) assert.ok(privacy.includes(disclosure), disclosure);
console.log('PASS operational privacy disclosures match the current integrations');
assert.ok(privacy.includes('does not submit your email to our backend'));
assert.ok(privacy.includes('withdraw consent') && privacy.includes('Office of the Data Protection Commissioner'));
console.log('PASS newsletter limitation and data-rights contact path are explicit');

const terms = legalPolicies.terms.sections.flatMap(section => section.paragraphs || []).join(' ');
for (const boundary of ['does not confirm payment', 'does not take payment on the website', 'Delivery is quoted separately', 'installation and maintenance', 'does not impose a blanket no-refund rule', 'Nothing here waives consumer or data-protection rights']) assert.ok(terms.includes(boundary), boundary);
console.log('PASS WhatsApp-first ordering, direct services and mandatory rights are preserved');
console.log('5 legal-document checks passed. These check structure and code alignment, not legal compliance.');
