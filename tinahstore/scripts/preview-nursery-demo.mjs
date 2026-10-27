// Read-only verification of the running local demo; never accepts a deployed URL.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const profile = await mkdtemp(path.join(tmpdir(), 'seedlings-nursery-preview-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run',
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', 'about:blank',
], { stdio: 'ignore', windowsHide: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch {}
    await pause(100);
  }
  assert.ok(port, 'Preview Chrome did not start');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const pending = new Map();
  let sequence = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('Preview timed out: ' + method)); }, 8000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || 'Preview expression failed');
    return result.result?.value;
  };
  const until = async (expression, label) => {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(50); }
    throw Error('Preview not ready: ' + label);
  };
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*', 'https://accounts.google.com/*'] });
  const results = [];
  for (const width of [1280, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await until('document.querySelectorAll(".nursery-photo").length===3', 'three gallery cards');
    for (let index = 0; index < 3; index++) {
      await evaluate(`document.querySelectorAll('.nursery-photo img')[${index}].scrollIntoView({behavior:'instant',block:'center'})`);
      await until(`document.querySelectorAll('.nursery-photo img')[${index}].complete&&document.querySelectorAll('.nursery-photo img')[${index}].naturalWidth>0`, 'local photo ' + index);
    }
    await evaluate(`window.scrollTo({top:window.scrollY+document.querySelector('.nursery-gallery').getBoundingClientRect().top-document.querySelector('.site-header').offsetHeight-24,behavior:'instant'})`);
    await pause(800);
    const result = await evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
      columns:getComputedStyle(document.querySelector('.nursery-photo-grid')).gridTemplateColumns.split(' ').length,
      captions:[...document.querySelectorAll('.nursery-photo figcaption')].map(node=>node.textContent),
      urls:[...document.querySelectorAll('.nursery-photo img')].map(node=>node.src)})`);
    assert.equal(result.overflow, false);
    assert.equal(result.columns, width === 1280 ? 3 : 1);
    assert.ok(result.captions.every(caption => caption.startsWith('Demo -')));
    assert.ok(result.urls.every(url => url.startsWith('http://127.0.0.1:8000/media/nursery/demo/')));
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const filename = path.join(profile, `nursery-${width}.png`);
    await writeFile(filename, Buffer.from(screenshot.data, 'base64'));
    results.push({ ...result, screenshot: filename });
  }
  console.log(JSON.stringify({ results }, null, 2));
  await Promise.race([send('Browser.close'), pause(1000)]);
} finally {
  socket?.close(); chrome.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 1500).unref();
}
