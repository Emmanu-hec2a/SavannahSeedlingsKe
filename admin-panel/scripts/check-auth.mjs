// Browser regression checks against mock APIs only; no real accounts or services.
// Run after npm run build: node scripts/check-auth.mjs
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const requests = [];
const expiry = () => new Date(Date.now() + 8 * 3600000).toISOString();
const user = { id: 123, username: 'qa-staff', email: 'qa@example.test', is_staff: true };
const stats = { unread_orders_count: 0, unread_orders: [], orders_today: 0, orders_yesterday: 0,
  revenue_today: 0, pending_deposits_count: 0, pending_deposits_total: 0, balance_outstanding: 0,
  balance_orders_count: 0, orders_last_30_days: [], revenue_last_30_days: [], recent_orders: [] };

const injection = `<script>
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (String(url).includes('/api/v1/')) {
      const parsed = new URL(url, location.href);
      url = parsed.pathname + '?qa=' + encodeURIComponent(parent.qaCase);
    }
    return originalOpen.call(this, method, url, ...rest);
  };
  window.addEventListener('error', e => parent.qaErrors.push(e.message));
  window.addEventListener('unhandledrejection', e => parent.qaErrors.push(String(e.reason)));
</script>`;

const page = `<!doctype html><title>Admin auth checks</title><pre id="qa-results">Running</pre>
<script>
window.qaCase = '';
window.qaErrors = [];
const results = [];
let frame;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const doc = () => frame.contentDocument;
const body = () => doc()?.body?.innerText || '';
const until = async (fn, label) => {
  for (let i=0; i<250; i++) { try { if (fn()) return; } catch {} await pause(40); }
  throw new Error('Timed out: ' + label + ' | ' + body().slice(0,250));
};
const assert = (condition, label) => { if (!condition) throw new Error(label); };
async function load(name, token, width=390) {
  if (frame) frame.remove();
  sessionStorage.clear(); localStorage.clear();
  localStorage.setItem('ts_auth_token', 'customer-untouched');
  if (token) sessionStorage.setItem('ts_admin_token', token);
  if (name === 'legacy') localStorage.setItem('ts_admin_token', 'old-staff-token');
  qaCase = name;
  frame = document.createElement('iframe');
  frame.width = width; frame.height = 844;
  frame.src = '/dashboard?case=' + name;
  document.body.append(frame);
  await until(() => doc()?.querySelector('#root')?.childElementCount, name + ' render');
}
async function signIn(username) {
  const setter = Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLInputElement.prototype, 'value').set;
  for (const [id,value] of [['admin-username',username],['admin-password','mock-password']]) {
    const input = doc().getElementById(id);
    setter.call(input,value);
    input.dispatchEvent(new frame.contentWindow.Event('input', {bubbles:true}));
  }
  await pause(80);
  doc().querySelector('form').requestSubmit();
}
async function test(name, run) {
  try { await run(); results.push({name, pass:true}); }
  catch (error) { results.push({name, pass:false, error:error.message}); }
}
(async () => {
  await test('anonymous direct route is protected', async () => {
    await load('anonymous');
    await until(() => doc().getElementById('admin-username'), 'login');
    assert(frame.contentWindow.location.pathname === '/login', 'not redirected');
  });
  await test('legacy local token is cleared without touching customer token', async () => {
    await load('legacy');
    await until(() => doc().getElementById('admin-username'), 'legacy login');
    assert(!localStorage.getItem('ts_admin_token'), 'legacy token retained');
    assert(localStorage.getItem('ts_auth_token') === 'customer-untouched', 'customer token changed');
  });
  await test('forged token cannot open dashboard', async () => {
    await load('forged', 'forged');
    await until(() => doc().getElementById('admin-username'), 'forged rejection');
    assert(!sessionStorage.getItem('ts_admin_token'), 'forged token retained');
  });
  await test('valid session restores staff identity after refresh', async () => {
    await load('valid', 'valid-session', 1280);
    await until(() => body().includes('qa-staff') && body().includes('Recent Orders'), 'restored dashboard');
    const previous = doc();
    frame.contentWindow.location.reload();
    await until(() => doc() !== previous && body().includes('qa-staff'), 'identity on refresh');
  });
  await test('nonstaff session response fails closed', async () => {
    await load('buyer', 'buyer-session');
    await until(() => doc().getElementById('admin-username'), 'buyer rejection');
    assert(!sessionStorage.getItem('ts_admin_token'), 'buyer token retained');
  });
  await test('expired session response fails closed', async () => {
    await load('expired', 'expired-session');
    await until(() => doc().getElementById('admin-username'), 'expiry rejection');
  });
  await test('server outage blocks access and retry recovers', async () => {
    await load('offline', 'valid-session');
    await until(() => body().includes('Unable to verify'), 'offline status');
    assert(!body().includes('Nursery Manager'), 'dashboard admitted offline');
    qaCase = 'retry';
    [...doc().querySelectorAll('button')].find(b => b.textContent === 'Try again').click();
    await until(() => body().includes('qa-staff'), 'retry recovery');
  });
  await test('buyer login is denied with inline error', async () => {
    await load('denied');
    await until(() => doc().getElementById('admin-username'), 'login form');
    await signIn('buyer');
    await until(() => body().includes('A staff account is required'), 'staff error');
    assert(!sessionStorage.getItem('ts_admin_token'), 'buyer login stored a token');
  });
  await test('staff login saves tab session and opens intended route', async () => {
    await load('login');
    await until(() => doc().getElementById('admin-username'), 'staff login form');
    await signIn('qa-staff');
    await until(() => body().includes('qa-staff') && body().includes('Recent Orders'), 'staff dashboard');
    assert(sessionStorage.getItem('ts_admin_token') === 'valid-session', 'missing session token');
    assert(!localStorage.getItem('ts_admin_token'), 'persisted token in localStorage');
    assert(frame.contentWindow.location.search === '?case=login', 'return query lost');
  });
  await test('logout clears session and calls revocation endpoint', async () => {
    await load('logout', 'valid-session');
    await until(() => body().includes('qa-staff'), 'logout dashboard');
    [...doc().querySelectorAll('button')].find(b => b.textContent.includes('Logout')).click();
    await until(() => doc().getElementById('admin-username'), 'signed out');
    assert(!sessionStorage.getItem('ts_admin_token'), 'logout retained token');
    assert(localStorage.getItem('ts_auth_token') === 'customer-untouched', 'customer signed out');
    await pause(200);
  });
  document.getElementById('qa-results').textContent = JSON.stringify({results, errors:qaErrors});
  if (frame) frame.remove();
})();
</script>`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__auth-checks') {
      res.setHeader('Content-Type','text/html'); res.end(page); return;
    }
    if (url.pathname.startsWith('/api/v1/')) {
      const scenario = url.searchParams.get('qa');
      const authenticated = req.headers.authorization === 'AdminToken valid-session';
      requests.push({scenario, path:url.pathname, method:req.method, authenticated});
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      let body = '';
      for await (const chunk of req) body += chunk;
      let status = 200, data;
      if (url.pathname.endsWith('/auth/login/')) {
        if (JSON.parse(body).username === 'buyer') { status = 403; data = {detail:'A staff account is required'}; }
        else data = {token:'valid-session', user, expires_at:expiry()};
      } else if (url.pathname.endsWith('/auth/me/')) {
        if (scenario === 'offline') { status = 503; data = {}; }
        else if (scenario === 'forged') { status = 401; data = {}; }
        else data = {user:{...user, is_staff:scenario !== 'buyer'},
          expires_at:scenario === 'expired' ? new Date(0).toISOString() : expiry()};
      } else if (url.pathname.endsWith('/auth/logout/')) { status=204; }
      else if (authenticated) data = stats;
      else { status=401; data={}; }
      res.statusCode=status;
      res.end(status === 204 ? '' : JSON.stringify(data));
      return;
    }
    const requested = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!requested.startsWith(root)) { res.writeHead(403).end(); return; }
    const isAsset = url.pathname.startsWith('/assets/') || /\.(png|ico)$/.test(url.pathname);
    const file = isAsset ? requested : path.join(root, 'index.html');
    let content = await readFile(file);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    if (!isAsset) content = content.toString().replace('<head>', '<head>' + injection);
    res.end(content);
  } catch (error) { res.writeHead(500).end(error.message); }
});

server.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const profile = await mkdtemp(path.join(tmpdir(), 'nursery-auth-qa-'));
try {
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const {stdout} = await promisify(execFile)(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--user-data-dir=' + profile, '--virtual-time-budget=60000', '--dump-dom',
    'http://127.0.0.1:' + server.address().port + '/__auth-checks'], {timeout:55000, maxBuffer:4*1024*1024});
  const encoded = stdout.match(/<pre id="qa-results">([\s\S]*?)<\/pre>/)?.[1];
  const report = JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
  console.log(JSON.stringify(report, null, 2));
  const forbiddenStats = requests.filter(r => ['anonymous','legacy','forged','buyer','expired','offline','denied'].includes(r.scenario) && r.path.endsWith('/dashboard/'));
  const logout = requests.some(r => r.scenario === 'logout' && r.path.endsWith('/auth/logout/') && r.method === 'POST' && r.authenticated);
  console.log(JSON.stringify({forbiddenStatsRequests:forbiddenStats.length, logoutRevocationCalled:logout}));
  if (report.results.some(r => !r.pass) || report.errors.length || forbiddenStats.length || !logout) process.exitCode=1;
} finally {
  server.closeAllConnections();
  server.close();
}
