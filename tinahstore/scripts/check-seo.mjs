// Production HTML + real-browser checks with local fixtures only. No live API,
// Google login, social accounts, or Search Console requests are made.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSiteIdentity, getSocialIdentity, siteMetadata } from '../src/data/siteMetadata.js';
import { siteBrandingPlugin } from './lib/site-branding-plugin.mjs';
import { localBrowser } from './lib/local-browser.mjs';

let checks = 0;
async function test(name, run) {
  await run(); checks++;
  console.log(`PASS ${name}`);
}
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const identity = JSON.parse(html.match(/<script id="site-identity" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || 'null');

await test('initial HTML has one stable WebSite and Organization before JavaScript runs', () => {
  assert.deepEqual(identity, getSiteIdentity());
  assert.equal(identity['@graph'].filter(node => node['@type'] === 'WebSite').length, 1);
  assert.equal(identity['@graph'][0].name, 'Savannah Seedlings');
  assert.equal(identity['@graph'][0].url, 'https://savannahseedlings.com/');
  assert.equal(identity['@graph'][1].logo, 'https://savannahseedlings.com/logo_seal.png');
  assert.equal((html.match(/id="site-identity"/g) || []).length, 1);
});
await test('initial HTML includes share metadata without falsely canonicalizing every SPA route to Home', () => {
  for (const name of ['og:site_name', 'og:title', 'og:description', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert.equal((html.match(new RegExp(`(?:name|property)="${name}"`, 'g')) || []).length, 1, name);
  }
  assert.equal((html.match(/<title\b/g) || []).length, 1);
  assert.ok(html.includes(siteMetadata.title));
  assert.ok(!html.includes('rel="canonical"'));
  assert.ok(!html.includes('property="og:url"'));
  assert.ok(!html.includes('noindex'));
  const tags = siteBrandingPlugin().transformIndexHtml();
  assert.ok(tags.filter(tag => tag.tag === 'meta').every(tag => tag.attrs['data-site-default'] === 'true'));
  assert.ok(!tags.find(tag => tag.attrs?.id === 'site-identity').attrs['data-site-default']);
});
await test('unknown social accounts are omitted rather than invented', () => {
  assert.deepEqual(getSocialIdentity({}), { sameAs: [], twitterSite: undefined });
  assert.ok(!('sameAs' in getSiteIdentity({})['@graph'][1]));
  const configured = getSocialIdentity();
  if (!configured.sameAs.length) assert.ok(!('sameAs' in identity['@graph'][1]));
  if (!configured.twitterSite) assert.ok(!html.includes('name="twitter:site"'));
});
await test('confirmed social profile configuration populates sameAs and the X handle', () => {
  const fixtures = {
    facebook: 'https://www.facebook.com/fixture.nursery',
    instagram: 'https://www.instagram.com/fixture.nursery/',
    tiktok: 'https://www.tiktok.com/@fixture.nursery',
    x: 'https://x.com/fixture_nursery',
    youtube: 'https://www.youtube.com/@fixture.nursery',
    linkedin: 'https://www.linkedin.com/company/fixture-nursery/',
    threads: 'https://www.threads.com/@fixture.nursery',
  };
  assert.deepEqual(getSiteIdentity(fixtures)['@graph'][1].sameAs, Object.values(fixtures));
  assert.equal(getSocialIdentity(fixtures).twitterSite, '@fixture_nursery');
  assert.equal(getSocialIdentity({ x: 'https://twitter.com/fixture_nursery/' }).twitterSite, '@fixture_nursery');
});
await test('invalid social URLs and X sharing/post links are rejected', () => {
  for (const profiles of [
    { facebook: 'http://facebook.com/fixture' }, { instagram: 'https://instagram.com/' },
    { tiktok: 'https://unrelated.invalid/@fixture' }, { x: 'https://x.com/intent' },
    { x: 'https://x.com/fixture/status/123' }, { x: 'https://user:password@x.com/fixture' },
    { x: 'https://x.com/fixture#fragment' }, { unknown: 'https://example.test/profile' },
  ]) assert.throws(() => getSocialIdentity(profiles));
});

const expectedPngs = {
  'favicon.png': [96, 96], 'apple-touch-icon.png': [180, 180],
  'icon-192.png': [192, 192], 'icon-512.png': [512, 512], 'og-image.png': [1200, 630],
};
await test('all published PNGs exist with their declared dimensions and the manifest is truthful', async () => {
  for (const [filename, size] of Object.entries(expectedPngs)) {
    const content = await readFile(path.join(dist, filename));
    assert.equal(content.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', filename);
    assert.deepEqual([content.readUInt32BE(16), content.readUInt32BE(20)], size, filename);
  }
  const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));
  for (const icon of manifest.icons) assert.equal(icon.sizes, expectedPngs[icon.src.replace(/^\//, '')].join('x'));
  assert.ok(html.includes('sizes="96x96" href="/favicon.png"'));
  assert.ok(html.includes('sizes="180x180" href="/apple-touch-icon.png"'));
  assert.match(await readFile(path.join(dist, 'favicon.svg'), 'utf8'), /viewBox="0 0 120 120"/);
});

const fixtureProduct = {
  id: 9001, slug: 'fixture-seedling', name: 'Fixture Grafted Seedling',
  description: 'A local fixture used to verify product-specific metadata.', category: 'Fruit',
  price: '350.00', stock: 10, primary_image: '/icon-192.png', images: [], variants: [],
};
const inject = `<script>
window.__seoErrors=[];
addEventListener('error',event=>{if(event.message)window.__seoErrors.push(event.message)});
addEventListener('unhandledrejection',event=>window.__seoErrors.push(String(event.reason)));
const originalFetch=window.fetch;
window.fetch=(url,options)=>originalFetch.call(window,String(url).includes('/api/v1/')?new URL(url,location.href).pathname+new URL(url,location.href).search:url,options);
</script>`;
const types = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/v1/')) {
      const data = /\/products\/fixture-seedling\/$/.test(pathname) ? fixtureProduct :
        pathname.includes('nursery-photos') || pathname.includes('related') ? [] :
        { results: pathname.includes('categories') ? [{ id: 1, name: 'Fruit', slug: 'fruit' }] : [fixtureProduct], next: null, count: 1 };
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data)); return;
    }
    const type = types[path.extname(pathname)];
    const filename = type ? path.resolve(dist, '.' + decodeURIComponent(pathname)) : path.join(dist, 'index.html');
    const relative = path.relative(dist, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    let content = await readFile(filename);
    if (!type) content = String(content).replace('<head>', '<head>' + inject);
    res.writeHead(200, { 'Content-Type': type || 'text/html' }).end(content);
  } catch { res.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const interceptionErrors = [];
try {
  browser = await localBrowser();
  const { send, evaluate, until } = browser;
  browser.on('Fetch.requestPaused', ({ requestId, request }) => {
    const local = new URL(request.url).origin === origin;
    send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId } : { requestId, errorReason: 'BlockedByClient' })
      .catch(error => {
        // Navigation can cancel a paused request before CDP handles our reply.
        if (!error.message.includes('Invalid InterceptionId')) interceptionErrors.push(error.message);
      });
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http*' }] });
  await send('Page.enable');
  const snapshot = () => evaluate(`({
    title:document.title,
    titleCount:document.querySelectorAll('title').length,
    canonical:[...document.querySelectorAll('link[rel=canonical]')].map(node=>node.href),
    meta:[...document.querySelectorAll('meta[name],meta[property]')].map(node=>[node.getAttribute('name')||node.getAttribute('property'),node.content]),
    nodes:[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(node=>{const data=JSON.parse(node.textContent);return data['@graph']||[data].flat()}),
    errors:window.__seoErrors||[]
  })`);
  function assertUnique(data) {
    assert.equal(data.titleCount, 1, 'duplicate titles');
    assert.equal(new Set(data.meta.map(([key]) => key)).size, data.meta.length, 'duplicate metadata');
    assert.equal(data.nodes.filter(node => node['@type'] === 'WebSite').length, 1);
    assert.equal(data.nodes.filter(node => node['@type'] === 'Organization').length, 1);
    assert.deepEqual(data.errors, []);
  }
  const meta = (data, key) => data.meta.find(([name]) => name === key)?.[1];

  await test('homepage branding and sharing data are present with JavaScript disabled', async () => {
    await send('Emulation.setScriptExecutionDisabled', { value: true });
    await send('Page.navigate', { url: origin + '/' });
    await until('!!document.getElementById("site-identity")', 'initial HTML');
    const data = await snapshot(); assertUnique(data);
    assert.equal(data.title, siteMetadata.title);
    assert.equal(meta(data, 'og:site_name'), 'Savannah Seedlings');
    assert.equal(meta(data, 'og:image'), siteMetadata.image);
    assert.equal(meta(data, 'twitter:card'), 'summary_large_image');
    assert.equal(await evaluate('document.getElementById("root").childElementCount'), 0);
    await send('Emulation.setScriptExecutionDisabled', { value: false });
  });
  await test('React adopts initial metadata without duplicate tags or schemas', async () => {
    await send('Page.navigate', { url: origin + '/' });
    await until('!!document.querySelector(".hero")&&!!document.querySelector("link[rel=canonical]")', 'React homepage');
    const data = await snapshot(); assertUnique(data);
    assert.equal(data.canonical.length, 1);
    assert.equal(new URL(data.canonical[0]).href, siteMetadata.url + '/');
    assert.equal(meta(data, 'og:image:width'), '1200');
  });
  await test('direct product navigation replaces default sharing data and retains site identity', async () => {
    await send('Page.navigate', { url: origin + '/product/fixture-seedling' });
    await until(`document.querySelector('meta[property="og:type"]')?.content==='product'`, 'product metadata');
    const data = await snapshot(); assertUnique(data);
    assert.equal(data.canonical[0], siteMetadata.url + '/product/fixture-seedling');
    assert.equal(meta(data, 'description'), fixtureProduct.description);
    assert.equal(meta(data, 'og:image'), fixtureProduct.primary_image);
    assert.equal(meta(data, 'twitter:image'), fixtureProduct.primary_image);
    assert.equal(meta(data, 'og:image:width'), undefined);
    assert.equal(meta(data, 'og:image:height'), undefined);
    assert.equal(data.nodes.filter(node => node['@type'] === 'Product').length, 1);
  });
  await test('SPA navigation clears product schemas and preserves shop canonical metadata', async () => {
    await evaluate(`document.querySelector('a[href="/shop"]').click()`);
    await until(`location.pathname==='/shop'&&document.querySelector('meta[property="og:type"]')?.content==='website'`, 'shop navigation');
    const data = await snapshot(); assertUnique(data);
    assert.equal(data.canonical[0], siteMetadata.url + '/shop');
    assert.equal(data.nodes.filter(node => node['@type'] === 'Product').length, 0);
    assert.equal(meta(data, 'og:image'), siteMetadata.image);
    assert.equal(meta(data, 'og:image:width'), '1200');
  });
  await test('legal noindex stays scoped to legal pages and clears on return Home', async () => {
    await evaluate(`document.querySelector('a[href="/privacy-policy"]').click()`);
    await until('!!document.querySelector("meta[name=robots]")', 'legal noindex');
    let data = await snapshot(); assertUnique(data);
    assert.equal(meta(data, 'robots'), 'noindex,follow');
    assert.equal(data.canonical[0], siteMetadata.url + '/privacy-policy');
    await evaluate(`document.querySelector('a[href="/"]').click()`);
    await until('location.pathname==="/"&&!document.querySelector("meta[name=robots]")', 'home indexability');
    data = await snapshot(); assertUnique(data);
    assert.equal(data.title, siteMetadata.title);
  });
  await test('existing header logo stays intact with no horizontal overflow at mobile and desktop widths', async () => {
    for (const width of [320, 390, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
      assert.ok(await evaluate('[...document.querySelectorAll(".brand-mark")].every(image=>image.getAttribute("src")==="/logo_seal.png")'));
    }
  });
  await test('pages without their own SEO metadata retain defaults on direct load and SPA navigation', async () => {
    await evaluate(`document.querySelector('a[href="/account"]').click()`);
    await until(`location.pathname==='/account'&&!!document.querySelector('.account-card')`, 'account navigation');
    let data = await snapshot(); assertUnique(data);
    assert.equal(data.title, siteMetadata.title);
    assert.equal(meta(data, 'og:site_name'), siteMetadata.name);
    assert.equal(data.canonical.length, 0);
    await send('Page.navigate', { url: origin + '/signup' });
    await until(`!!document.querySelector('.account-card')`, 'signup direct load');
    data = await snapshot(); assertUnique(data);
    assert.equal(data.title, siteMetadata.title);
    await evaluate(`document.querySelector('a[href="/"]').click()`);
    await until(`location.pathname==='/'&&!!document.querySelector('.hero')`, 'return from signup');
    assertUnique(await snapshot());
  });
  assert.deepEqual(interceptionErrors, []);
} finally {
  await browser?.close();
  server.closeAllConnections(); server.close();
}
console.log(`${checks} SEO/branding checks passed. External requests were blocked; no production data changed.`);
