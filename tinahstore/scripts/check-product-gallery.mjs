// Real-browser checks against the production bundle using generated local JPEG
// fixtures, not business photos. No API writes, accounts or external requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localBrowser } from './lib/local-browser.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const photos = new Map();
const dimensions = { wide: [6000, 600], tall: [600, 6000], square: [2000, 2000] };
const products = Object.fromEntries(['wide', 'tall', 'square', 'five', 'many', 'empty'].map((slug, index) => [slug, {
  id: index + 1, slug, name: 'Fixture Seedling', category: 'Fruit', price: '350.00', original_price: '400.00', stock: 10,
  description: 'Local gallery sizing fixture.', planting_procedure: '1. Follow nursery guidance.',
  images: slug === 'empty' ? [] : Array.from({ length: slug === 'many' ? 18 : slug === 'five' ? 5 : 1 }, (_, i) => ({
    id: i + 1, image: `/__photos/${['many', 'five'].includes(slug) ? ['wide', 'tall', 'square'][i % 3] : slug}.jpg`,
    alt_text: `Fixture photo ${i + 1}`,
  })),
}]));
const inject = `<script>
window.__galleryErrors=[];
addEventListener('error',event=>{if(event.message)window.__galleryErrors.push(event.message)});
addEventListener('unhandledrejection',event=>window.__galleryErrors.push(String(event.reason)));
const originalFetch=window.fetch;
window.fetch=(url,options)=>originalFetch.call(window,String(url).includes('/api/v1/')?new URL(url,location.href).pathname:url,options);
</script>`;
const types = { '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (photos.has(pathname)) { res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(photos.get(pathname)); return; }
    if (pathname.startsWith('/api/v1/')) {
      const slug = pathname.match(/^\/api\/v1\/products\/([^/]+)\/$/)?.[1];
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(products[slug] || [])); return;
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
const results = [], errors = [];
const reviewDir = process.argv.includes('--screenshots') ? await mkdtemp(path.join(tmpdir(), 'seedlings-gallery-review-')) : null;
let browser;
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
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  for (const [shape, [width, height]] of Object.entries(dimensions)) {
    const data = await evaluate(`(() => {
      const canvas=document.createElement('canvas');canvas.width=${width};canvas.height=${height};
      const context=canvas.getContext('2d');
      context.fillStyle='#dcebd5';context.fillRect(0,0,canvas.width,canvas.height);
      context.fillStyle='#2e7d32';context.fillRect(canvas.width*.3,0,canvas.width*.4,canvas.height);
      context.fillStyle='#e67e22';context.fillRect(canvas.width*.4,canvas.height*.25,canvas.width*.2,canvas.height*.5);
      return canvas.toDataURL('image/jpeg',.85).split(',')[1];
    })()`);
    photos.set(`/__photos/${shape}.jpg`, Buffer.from(data, 'base64'));
  }
  async function test(name, run) {
    try { await run(); results.push({ name, pass: true }); console.log('PASS ' + name); }
    catch (error) { results.push({ name, pass: false, error: error.message }); console.log('FAIL ' + name + ': ' + error.message); }
  }
  async function viewport(width) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 768 });
    await send('Emulation.setTouchEmulationEnabled', { enabled: width <= 768, ...(width <= 768 ? { maxTouchPoints: 1 } : {}) });
  }
  async function load(slug, width) {
    await viewport(width);
    await send('Page.navigate', { url: origin + '/product/' + slug });
    await until(`location.pathname==='/product/${slug}'&&!!document.querySelector('.pd-gallery')`, 'product gallery');
    if (slug !== 'empty') await until(`document.querySelector('.main-shot>img')?.complete&&document.querySelector('.main-shot>img')?.naturalWidth>0`, 'decoded main photo');
  }
  async function geometry() {
    return evaluate(`(() => {
      const gallery=document.querySelector('.pd-gallery'),frame=document.querySelector('.main-shot');
      const rect=frame.getBoundingClientRect(),image=frame.querySelector('img'),r=image?.getBoundingClientRect();
      return {page:document.documentElement.scrollWidth,viewport:innerWidth,gallery:gallery.getBoundingClientRect().width,
        frame:{left:rect.left,right:rect.right,width:rect.width,height:rect.height},
        image:image?{width:r.width,height:r.height,fit:getComputedStyle(image).objectFit,natural:[image.naturalWidth,image.naturalHeight]}:null,
        bodyOverflow:getComputedStyle(document.body).overflowX,htmlOverflow:getComputedStyle(document.documentElement).overflowX};
    })()`);
  }
  function bounded(data) {
    assert.ok(data.page <= data.viewport + 1, JSON.stringify(data));
    assert.ok(data.frame.left >= -1 && data.frame.right <= data.viewport + 1, JSON.stringify(data));
    assert.ok(Math.abs(data.frame.width - data.frame.height) <= 1, 'main frame is not square: ' + JSON.stringify(data));
    assert.ok(!['hidden', 'clip'].includes(data.bodyOverflow) && !['hidden', 'clip'].includes(data.htmlOverflow), 'global overflow hiding masks sizing problems');
  }
  for (const shape of ['wide', 'tall', 'square']) {
    await test(`${shape} JPEG stays bounded without changing cover presentation at five screen widths`, async () => {
      for (const width of [320, 390, 768, 901, 1280]) {
        await load(shape, width);
        const data = await geometry(); bounded(data);
        assert.equal(data.viewport, width);
        assert.deepEqual(data.image.natural, dimensions[shape]);
        assert.equal(data.image.fit, 'cover');
        assert.ok(Math.abs(data.image.width - data.frame.width) <= 1 && Math.abs(data.image.height - data.frame.height) <= 1);
        assert.equal(await evaluate(`document.querySelectorAll('.thumb-row').length`), 0);
      }
    });
  }
  await test('five-photo and 18-photo galleries scroll inside their row without enlarging the page', async () => {
    for (const slug of ['five', 'many']) {
      for (const width of [320, 390, 768, 900, 901, 1280]) {
        await load(slug, width); const frame = await geometry(); bounded(frame); assert.equal(frame.viewport, width);
        const row = await evaluate(`(() => {
          const row=document.querySelector('.thumb-row'),buttons=[...row.querySelectorAll('button')];
          return {width:row.getBoundingClientRect().width,scroll:row.scrollWidth,client:row.clientWidth,overflow:getComputedStyle(row).overflowX,
            widths:buttons.map(button=>button.getBoundingClientRect().width)};
        })()`);
        assert.equal(row.widths.length, slug === 'many' ? 18 : 5);
        assert.ok(row.widths.every(value => Math.abs(value - 74) < 1), JSON.stringify(row));
        assert.equal(row.overflow, 'auto');
        if (slug === 'many' || width <= 390) assert.ok(row.scroll > row.client);
      }
    }
  });
  await test('switching among mixed image shapes keeps the frame and surrounding content stationary', async () => {
    await load('many', 390);
    const before = await geometry();
    const infoTop = await evaluate(`document.querySelector('.pd-info').getBoundingClientRect().top+scrollY`);
    for (const index of [1, 2, 3, 17]) {
      await evaluate(`document.querySelectorAll('.thumb')[${index}].click()`);
      await until(`document.querySelector('.main-shot>img').complete&&document.querySelector('.main-shot>img').naturalWidth>0`, 'selected photo');
      const after = await geometry(); bounded(after);
      assert.ok(Math.abs(after.frame.height - before.frame.height) <= 1);
      assert.ok(Math.abs(await evaluate(`document.querySelector('.pd-info').getBoundingClientRect().top+scrollY`) - infoTop) <= 1);
      assert.equal(await evaluate(`document.querySelector('.main-shot>img').alt`), `Fixture photo ${index + 1}`);
      assert.equal(await evaluate(`document.querySelectorAll('.thumb[aria-pressed=true]').length`), 1);
    }
  });
  await test('offscreen thumbnails remain keyboard reachable and selection is announced', async () => {
    await load('many', 390);
    await evaluate(`document.querySelector('.thumb:last-child').focus()`);
    await until(`document.querySelector('.thumb-row').scrollLeft>0`, 'focus scrolls thumbnail row');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await until(`document.querySelector('.thumb:last-child').getAttribute('aria-pressed')==='true'`, 'keyboard selection');
    const focus = await evaluate(`(() => {const button=document.activeElement,row=button.parentElement,r=button.getBoundingClientRect(),p=row.getBoundingClientRect();return {left:r.left-p.left,right:p.right-r.right,width:getComputedStyle(button).outlineWidth}})()`);
    assert.ok(focus.left >= 4 && focus.right >= 4, JSON.stringify(focus));
    assert.ok(parseFloat(focus.width) >= 2);
    bounded(await geometry());
  });
  await test('mobile touch swipe moves only the thumbnail strip, not the whole page', async () => {
    await load('many', 390);
    await evaluate(`document.querySelector('.thumb-row').scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})`);
    const row = await evaluate(`(() => {const r=document.querySelector('.thumb-row').getBoundingClientRect();return {x:r.right-20,y:r.top+30}})()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: row.x, y: row.y }] });
    for (let i = 1; i <= 8; i++) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: row.x - i * 25, y: row.y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await until(`document.querySelector('.thumb-row').scrollLeft>20`, 'native horizontal touch scroll');
    assert.equal(await evaluate('window.scrollX'), 0);
    bounded(await geometry());
  });
  await test('both themes preserve gallery spacing, sale label and existing page gutters', async () => {
    await load('many', 390);
    for (const theme of ['light', 'dark']) {
      await evaluate(`document.documentElement.dataset.theme='${theme}';new Promise(resolve=>setTimeout(resolve,300))`);
      const data = await evaluate(`(() => {
        const frame=document.querySelector('.main-shot'),r=frame.getBoundingClientRect(),badge=frame.querySelector('.sale-pill').getBoundingClientRect();
        return {left:r.left,right:innerWidth-r.right,background:getComputedStyle(frame).backgroundColor,gap:parseFloat(getComputedStyle(frame).marginBottom),
          saleInside:badge.left>=r.left&&badge.right<=r.right&&badge.top>=r.top&&badge.bottom<=r.bottom};
      })()`);
      assert.equal(data.left, 16); assert.equal(data.right, 16); assert.ok(data.gap >= 14); assert.ok(data.saleInside);
      assert.equal(data.background, theme === 'dark' ? 'rgb(18, 34, 19)' : 'rgb(232, 245, 233)');
      if (reviewDir) {
        await evaluate(`window.scrollTo({top:0,behavior:'instant'})`);
        const result = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(path.join(reviewDir, `gallery-390-${theme}.png`), Buffer.from(result.data, 'base64'));
      }
    }
  });
  await test('products without photos keep the existing placeholder and bounded frame', async () => {
    for (const width of [320, 390, 1280]) {
      await load('empty', width); bounded(await geometry());
      assert.equal(await evaluate(`document.querySelectorAll('.main-shot>svg').length`), 1);
      assert.equal(await evaluate(`document.querySelectorAll('.thumb-row').length`), 0);
    }
  });
  errors.push(...await evaluate('window.__galleryErrors'));
} finally {
  await browser?.close(); server.closeAllConnections(); server.close();
}
console.log(JSON.stringify({ results, errors, ...(reviewDir ? { reviewDir } : {}) }, null, 2));
if (results.some(result => !result.pass) || errors.length) process.exitCode = 1;
