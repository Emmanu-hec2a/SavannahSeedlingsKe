import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/hooks/useCountUp.js', import.meta.url), 'utf8'))
  .replace(/^import .*?;\r?\n/m, '')
  .replace('export function useCountUp', 'function useCountUp');

function harness({ value = '10,000+', reduce = false, observer = true, frames = true, media = true, duration = 1400 } = {}) {
  let display, sequence = 0;
  const effects = [], observers = [], pending = new Map(), listeners = new Map();
  const preference = { matches: reduce,
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: event => listeners.delete(event) };
  class IntersectionObserver {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe(node) { this.node = node; this.disconnected = false; }
    disconnect() { this.disconnected = true; }
    enter() { if (!this.disconnected) this.callback([{ isIntersecting: true, target: this.node }]); }
  }
  const window = {
    ...(media ? { matchMedia: () => preference } : {}),
    ...(observer ? { IntersectionObserver } : {}),
    ...(frames ? {
      requestAnimationFrame: callback => { const id = ++sequence; pending.set(id, callback); return id; },
      cancelAnimationFrame: id => pending.delete(id),
    } : {}),
  };
  vm.runInNewContext(source + '\nuseCountUp(valueRef, value, duration);', {
    Intl, window, valueRef: { current: {} }, value, duration,
    useState: initial => { display = initial; return [initial, next => { display = next; }]; },
    useLayoutEffect: effect => effects.push(effect),
  });
  let cleanup = effects[0]();
  return {
    get display() { return display; }, observers, pending, listeners,
    enter: () => observers.at(-1)?.enter(),
    tick(time) { const batch = [...pending.values()]; pending.clear(); batch.forEach(callback => callback(time)); },
    reduce() { preference.matches = true; listeners.get('change')?.(); },
    cleanup: () => cleanup?.(),
    remount() { cleanup?.(); cleanup = effects[0](); },
  };
}

const tests = [
  ['waits for viewport entry before requesting frames', () => {
    const h = harness();assert.equal(h.display, '0+');assert.equal(h.pending.size, 0);
    h.enter();assert.equal(h.pending.size, 1);
  }],
  ['counts smoothly and preserves grouping and suffix at completion', () => {
    const h = harness();h.enter();h.tick(100);assert.equal(h.display, '0+');
    h.tick(800);assert.equal(h.display, '8,750+');
    h.tick(1500);assert.equal(h.display, '10,000+');assert.equal(h.pending.size, 0);
  }],
  ['keeps configured final formatting for small integers', () => {
    for (const value of ['5+', '10+', '3']) {
      const h = harness({ value });h.enter();h.tick(0);h.tick(1400);assert.equal(h.display, value);
    }
  }],
  ['does not replay after scrolling away and back', () => {
    const h = harness();h.enter();h.tick(0);h.tick(1400);h.enter();
    assert.equal(h.display, '10,000+');assert.equal(h.pending.size, 0);
  }],
  ['reduced motion shows the final value without a zero flash', () => {
    const h = harness({ reduce: true });assert.equal(h.display, '10,000+');
    assert.equal(h.observers.length, 0);assert.equal(h.pending.size, 0);
  }],
  ['enabling reduced motion finishes and cancels the running animation', () => {
    const h = harness();h.enter();h.tick(0);h.tick(400);h.reduce();
    assert.equal(h.display, '10,000+');assert.equal(h.pending.size, 0);
    h.enter();assert.equal(h.pending.size, 0);
  }],
  ['enabling reduced motion before entry avoids a future counter', () => {
    const h = harness();h.reduce();h.enter();
    assert.equal(h.display, '10,000+');assert.equal(h.pending.size, 0);
  }],
  ['unsupported APIs leave final values readable', () => {
    for (const options of [{ observer: false }, { frames: false }, { media: false }]) {
      const h = harness(options);assert.equal(h.display, '10,000+');assert.equal(h.observers.length, 0);
    }
  }],
  ['non-numeric labels and zero remain unchanged', () => {
    for (const value of ['Across Africa', '0', '2.5+', '-1', '100000000000000000000']) {
      const h = harness({ value });assert.equal(h.display, value);assert.equal(h.observers.length, 0);
    }
  }],
  ['unmount cancels pending frames and preference listeners', () => {
    const h = harness();h.enter();h.tick(0);h.cleanup();
    assert.equal(h.pending.size, 0);assert.equal(h.listeners.size, 0);assert.ok(h.observers[0].disconnected);
  }],
  ['strict-mode effect replay creates only one active counter', () => {
    const h = harness();h.enter();h.tick(0);h.remount();
    assert.ok(h.observers[0].disconnected);assert.equal(h.pending.size, 0);
    h.enter();h.tick(0);h.tick(1400);assert.equal(h.display, '10,000+');assert.equal(h.pending.size, 0);
  }],
];

for (const [name, test] of tests) { test(); console.log('PASS ' + name); }
console.log(`${tests.length} count-up checks passed.`);
