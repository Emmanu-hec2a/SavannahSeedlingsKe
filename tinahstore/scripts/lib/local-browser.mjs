// Small local-only CDP harness. Uses a disposable Chrome profile, never a user's
// browser session. Both callers (asset generation and SEO checks) need no login.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function localBrowser() {
  const prefix = 'seedlings-branding-';
  const profile = await mkdtemp(path.join(tmpdir(), prefix));
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  let startupError, socket, sequence = 0;
  const pending = new Map(), listeners = new Map();
  chrome.on('error', error => { startupError = error; });

  async function close() {
    if (socket?.readyState === WebSocket.OPEN) {
      try { await send('Browser.close'); } catch { /* Chrome can close the socket first. */ }
    }
    socket?.close();
    for (const callback of pending.values()) callback.reject(Error('Browser closed'));
    pending.clear();
    for (let i = 0; i < 30 && chrome.exitCode === null && !startupError; i++) await pause(100);
    if (chrome.exitCode === null && !startupError) chrome.kill();
    // Only remove the exact temporary profile this invocation created.
    assert.equal(path.dirname(profile), path.resolve(tmpdir()));
    assert.ok(path.basename(profile).startsWith(prefix));
    await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timed out: ${method}`)); }, 10000);
      pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      try { socket.send(JSON.stringify({ id, method, params })); }
      catch (error) { pending.get(id).reject(error); pending.delete(id); }
    });
  }

  try {
    let port;
    for (let i = 0; i < 100; i++) {
      if (startupError) throw startupError;
      try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
      catch { await pause(100); }
    }
    assert.ok(port, 'Chrome did not start. Set CHROME_PATH to a local Chrome executable.');
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const callback = pending.get(message.id);
      if (callback) {
        pending.delete(message.id);
        message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result);
      } else {
        for (const listener of listeners.get(message.method) || []) listener(message.params);
      }
    });
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || 'Browser evaluation failed');
      return result.result?.value;
    }
    return {
      send, evaluate, close,
      on(method, listener) {
        if (!listeners.has(method)) listeners.set(method, []);
        listeners.get(method).push(listener);
      },
      async until(expression, label = expression) {
        for (let i = 0; i < 160; i++) {
          if (await evaluate(expression)) return;
          await pause(50);
        }
        throw Error(`Timed out: ${label}`);
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
