// Plain-text parser and built-product-page checks. All data is disposable local
// fixture data; external network requests are blocked before navigation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProductCopy } from '../src/components/product/productCopy.js';
import { localBrowser } from './lib/local-browser.mjs';

let count = 0;
async function test(name, run) { await run(); count++; console.log(`PASS ${name}`); }
await test('paragraphs, blank lines and single line breaks are preserved', () => {
  assert.deepEqual(parseProductCopy('First line.\nSecond line.\n\nNew paragraph.'), [
    { type: 'paragraph', text: 'First line.\nSecond line.' }, { type: 'paragraph', text: 'New paragraph.' },
  ]);
});
await test('Windows and old-Mac newlines normalize without changing words', () => {
  assert.deepEqual(parseProductCopy('First\r\nSecond\r\n\r\nThird\rFourth'), parseProductCopy('First\nSecond\n\nThird\nFourth'));
});
await test('both numbered-step markers retain the author numbering', () => {
  assert.deepEqual(parseProductCopy('3. First step\n4) Second step\n\n7. Later step'), [
    { type: 'ordered', items: [{ number: 3, text: 'First step' }, { number: 4, text: 'Second step' }, { number: 7, text: 'Later step' }] },
  ]);
});
await test('hyphens, asterisks and bullet symbols become one semantic list', () => {
  assert.deepEqual(parseProductCopy('- First\n* Second\n\u2022 Third'), [
    { type: 'unordered', items: [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }] },
  ]);
});
await test('mixed paragraphs and lists stay in their original order', () => {
  assert.deepEqual(parseProductCopy('Introduction\n\n- Benefit\n\nCare notes\n1. Step\n2. Step'), [
    { type: 'paragraph', text: 'Introduction' }, { type: 'unordered', items: [{ text: 'Benefit' }] },
    { type: 'paragraph', text: 'Care notes' }, { type: 'ordered', items: [{ number: 1, text: 'Step' }, { number: 2, text: 'Step' }] },
  ]);
});
await test('indented continuation lines stay with their list item', () => {
  assert.equal(parseProductCopy('1. Step\n  Further detail\n2. Next')[0].items[0].text, 'Step\nFurther detail');
});
await test('decimal measurements and ordinary punctuation are not interpreted as lists', () => {
  const text = '1.5 m spacing\n2ft x 2ft hole\n-5 degrees\n2026 harvest\nA sentence with 1. numbered-looking text.';
  assert.deepEqual(parseProductCopy(text), [{ type: 'paragraph', text }]);
});
await test('empty or missing text is safe and literal HTML is never parsed', () => {
  for (const value of [undefined, null, '', ' \n\t\r\n']) assert.deepEqual(parseProductCopy(value), []);
  const text = '<img src=x onerror="window.__copyExecuted=true"> & <script>alert(1)</script>';
  assert.deepEqual(parseProductCopy(text), [{ type: 'paragraph', text }]);
});

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const outputDir = process.argv.includes('--screenshots') ? await mkdtemp(path.join(tmpdir(), 'seedlings-product-copy-')) : null;
const description = 'Certified grafted seedling for your farm.\nAsk our team about local growing conditions.\n\nSuitable for home gardens and orchards.\n\n- Nursery-grown planting stock\n\u2022 Planting support from Savannah';
const procedure = 'Before planting, prepare your site.\n\n1. Prepare the planting area.\n  Keep the seedling upright while you work.\n2) Remove the nursery sleeve carefully.\n\n4. Finish planting and contact our team for care advice.\n\nAsk the nursery about the right schedule for your farm.';
const literal = '<img src=x onerror="window.__copyExecuted=true"> <script>window.__copyExecuted=true</script>';
const products = Object.fromEntries(['formatted', 'fallback', 'literal', 'long'].map((slug, index) => [slug, {
  id: index + 1, slug, name: 'Local Fixture Seedling', category: 'Fruit', stock: 10, price: '350.00', images: [], variants: [],
  primary_image: '/icon-512.png',
  description: slug === 'literal' ? literal : slug === 'long' ? 'Long detail ' + 'word'.repeat(150) : description,
  planting_procedure: slug === 'fallback' ? ' \n ' : slug === 'literal' ? literal : slug === 'long'
    ? Array.from({ length: 40 }, (_, i) => `${i + 1}. Local fixture care step ${i + 1}. ${'Additional detail. '.repeat(8)}`).join('\n') : procedure,
}]));
const inject = `<script>
window.__copyErrors=[];
addEventListener('error',event=>{if(event.message)window.__copyErrors.push(event.message)});
addEventListener('unhandledrejection',event=>window.__copyErrors.push(String(event.reason)));
const originalFetch=window.fetch;
window.fetch=(url,options)=>originalFetch.call(window,String(url).includes('/api/v1/')?new URL(url,location.href).pathname:url,options);
</script>`;
const types = { '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/v1/')) {
      const slug = pathname.match(/^\/api\/v1\/products\/([^/]+)\/$/)?.[1];
      const data = products[slug] || [];
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
server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
try {
  browser = await localBrowser();
  const { send, evaluate, until } = browser;
  browser.on('Fetch.requestPaused', ({ requestId, request }) => {
    const local = new URL(request.url).origin === origin;
    send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId } : { requestId, errorReason: 'BlockedByClient' })
      .catch(error => { if (!error.message.includes('Invalid InterceptionId')) errors.push(error.message); });
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http*' }] });
  await send('Page.enable');
  async function load(slug) {
    await send('Page.navigate', { url: origin + '/product/' + slug });
    await until(`location.pathname==='/product/${slug}'&&!!document.querySelector('.pd-care .product-copy')`, 'product copy render');
  }
  await load('formatted');
  await test('description renders real paragraphs and bullet lists, not a wall of text', async () => {
    assert.equal(await evaluate(`document.querySelectorAll('.pd-desc>p').length`), 2);
    assert.equal(await evaluate(`document.querySelectorAll('.pd-desc>ul>li').length`), 2);
    assert.equal(await evaluate(`document.querySelector('.pd-desc>p').textContent`), description.split('\n\n')[0]);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.pd-desc>p')).whiteSpace`), 'pre-line');
  });
  await test('procedures render semantic ordered steps with spacing and their original numbers', async () => {
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.pd-care ol>li')].map(node=>node.value)`), [1, 2, 4]);
    assert.equal(await evaluate(`document.querySelectorAll('.pd-care .product-copy>p').length`), 2);
    assert.ok(await evaluate(`parseFloat(getComputedStyle(document.querySelectorAll('.pd-care li')[1]).marginTop)>=10`));
    assert.equal(await evaluate(`document.querySelector('.pd-care li').textContent`), 'Prepare the planting area.\nKeep the seedling upright while you work.');
  });
  await test('mobile/desktop typography and care colors adapt to both themes without overflow', async () => {
    for (const width of [320, 390, 768, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      for (const theme of ['light', 'dark']) {
        await evaluate(`document.documentElement.dataset.theme='${theme}';new Promise(resolve=>setTimeout(resolve,300))`);
        const data = await evaluate(`(() => {
          const copy=document.querySelector('.pd-care .product-copy'),card=document.querySelector('.pd-care');
          const textStyle=getComputedStyle(copy),cardStyle=getComputedStyle(card);
          return {overflow:document.documentElement.scrollWidth>innerWidth,font:parseFloat(textStyle.fontSize),
            line:parseFloat(textStyle.lineHeight),color:textStyle.color,background:cardStyle.backgroundColor,
            padding:parseFloat(cardStyle.paddingLeft),paragraphGap:parseFloat(getComputedStyle(document.querySelectorAll('.pd-desc>p')[1]).marginTop)};
        })()`);
        assert.equal(data.overflow, false, `${width}px ${theme}`);
        assert.ok(data.font >= 14 && data.line >= data.font * 1.7);
        assert.ok(data.padding >= 18 && data.paragraphGap >= 14, JSON.stringify({ width, theme, ...data }));
        assert.equal(data.background, theme === 'dark' ? 'rgb(18, 34, 19)' : 'rgb(232, 245, 233)');
        assert.equal(data.color, theme === 'dark' ? 'rgb(241, 248, 233)' : 'rgb(27, 38, 27)');
        if (outputDir && [390, 1280].includes(width)) {
          const clip = await evaluate(`(() => {const r=document.querySelector('.pd-info').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`);
          const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
          await writeFile(path.join(outputDir, `product-${width}-${theme}.png`), Buffer.from(result.data, 'base64'));
        }
      }
    }
  });
  await test('quantity, add-to-cart, stock display and WhatsApp handoff remain unchanged', async () => {
    await evaluate(`document.querySelector('button[aria-label="Increase quantity"]').click()`);
    await until(`document.querySelector('.qty-val').textContent==='2'`, 'quantity selection');
    await evaluate(`[...document.querySelectorAll('button')].find(button=>/Add to Order/i.test(button.textContent)).click()`);
    await until(`JSON.parse(localStorage.getItem('ts_cart')||'[]').some(item=>item.productId===1&&item.quantity===2)`, 'local cart update');
    assert.match(await evaluate(`document.querySelector('.stock-note').textContent`), /10 seedlings available/);
    const href = await evaluate(`document.querySelector('.pd-actions a').href`);
    assert.equal(new URL(href).hostname, 'wa.me');
    assert.match(new URL(href).searchParams.get('text'), /2x Local Fixture Seedling/);
  });
  await test('blank planting procedures still show all five existing fallback steps', async () => {
    await load('fallback');
    assert.equal(await evaluate(`document.querySelectorAll('.pd-care ol>li').length`), 5);
    assert.match(await evaluate(`document.querySelector('.pd-care li').textContent`), /Dig a hole/);
  });
  await test('HTML-looking content remains visible text and cannot inject elements or execute', async () => {
    await load('literal');
    assert.equal(await evaluate(`document.querySelector('.pd-desc').textContent`), literal);
    assert.equal(await evaluate(`document.querySelector('.pd-care .product-copy').textContent`), literal);
    assert.equal(await evaluate(`document.querySelectorAll('.product-copy img,.product-copy script').length`), 0);
    assert.ok(!await evaluate(`window.__copyExecuted`));
  });
  await test('long guides are not clipped and long words cannot stretch mobile layout', async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
    await load('long');
    assert.equal(await evaluate(`document.querySelectorAll('.pd-care ol>li').length`), 40);
    assert.ok(await evaluate(`document.querySelector('.pd-care li:last-child').getBoundingClientRect().bottom<document.querySelector('.pd-care').getBoundingClientRect().bottom`));
    assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`));
  });
  assert.deepEqual(await evaluate('window.__copyErrors'), []);
  assert.deepEqual(errors, []);
} finally {
  await browser?.close(); server.closeAllConnections(); server.close();
}
console.log(`${count} product-copy checks passed. No saved products were changed.`);
if (outputDir) console.log('Review screenshots: ' + outputDir);
