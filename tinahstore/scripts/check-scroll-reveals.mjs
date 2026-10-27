// Lightweight tests of the real hook with DOM/observer stand-ins, not Chrome.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/hooks/useSectionReveals.js', import.meta.url), 'utf8'))
  .replace(/^import .*?;\r?\n/m, '')
  .replace('export function useSectionReveals', 'function useSectionReveals');

function harness({ reduce = false, observer = true, animate = true, mutation = true, focused = false } = {}) {
  const intersections = [], mutations = [], listeners = new Map(), effects = [];
  class Element {
    constructor(reveal) { this.dataset = reveal ? { reveal } : {}; this.children = []; this.calls = []; this.events = new Map(); }
    matches() { return 'reveal' in this.dataset; }
    querySelectorAll() { return this.children.flatMap(node => [...(node.matches() ? [node] : []), ...node.querySelectorAll()]); }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    addEventListener(name, fn) { this.events.set(name, fn); }
    removeEventListener(name) { this.events.delete(name); }
    animate(frames, options) {
      const animation = { frames, options, cancelled: false,
        cancel() { this.cancelled = true; this.oncancel?.(); } };
      this.calls.push(animation);
      return animation;
    }
  }
  if (!animate) delete Element.prototype.animate;
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); intersections.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
    enter(target) { if (this.targets.has(target)) this.callback([{ target, isIntersecting: true }]); }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; mutations.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const preference = { matches: reduce,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); } };
  const root = new Element(), first = new Element('fade');
  root.children.push(first);
  const document = { activeElement: focused ? first : null };
  const window = { matchMedia: () => preference, getComputedStyle: node => ({ opacity: String(node.opacity ?? 1) }),
    ...(observer ? { IntersectionObserver } : {}), ...(mutation ? { MutationObserver } : {}) };
  vm.runInNewContext(source + '\nuseSectionReveals(rootRef);', {
    useEffect: effect => effects.push(effect), rootRef: { current: root },
    window, document, Element, IntersectionObserver, MutationObserver,
  });
  const cleanup = effects[0]();
  return { root, first, preference, document, intersections, mutations, listeners, cleanup,
    enter: target => intersections[0]?.enter(target),
    append(node) { root.children.push(node); mutations[0]?.callback([{ addedNodes: [node] }]); },
    element: reveal => new Element(reveal) };
}

const tests = [
  ['fade respects the existing design opacity without an end-of-animation jump', () => {
    const h = harness(); h.first.opacity = 0.7; h.enter(h.first);
    assert.equal(h.first.calls[0].frames[1].opacity, 0.7);
  }],
  ['fade starts only at viewport entry, without moving content', () => {
    const h = harness();
    assert.equal(h.first.calls.length, 0);
    h.enter(h.first);
    const animation = h.first.calls[0];
    assert.equal(animation.frames[0].opacity, 0);
    assert.equal(animation.frames[1].opacity, 1);
    assert.ok(animation.frames.every(frame => !('transform' in frame)));
    assert.equal(animation.options.duration, 600);
  }],
  ['content reveals only once after leaving and returning', () => {
    const h = harness(); h.enter(h.first); h.first.calls[0].onfinish(); h.enter(h.first);
    assert.equal(h.first.calls.length, 1);
  }],
  ['asynchronously inserted cards are observed and fade independently', () => {
    const h = harness(), group = h.element(), card = h.element('fade');
    group.children.push(card); h.append(group);
    assert.ok(h.intersections[0].targets.has(card));
    assert.equal(card.calls.length, 0); h.enter(card);
    assert.equal(card.calls.length, 1); assert.equal(h.first.calls.length, 0);
  }],
  ['DOM updates do not reobserve an already revealed card', () => {
    const h = harness(); h.enter(h.first); h.append(h.first);
    assert.ok(!h.intersections[0].targets.has(h.first));
  }],
  ['reduced motion never starts reveal animations', () => {
    const h = harness({ reduce: true }); h.enter(h.first);
    assert.equal(h.first.calls.length, 0);
  }],
  ['changing preference cancels an active reveal', () => {
    const h = harness(); h.enter(h.first); h.preference.matches = true; h.listeners.get('change')();
    assert.ok(h.first.calls[0].cancelled);
  }],
  ['focused content is not faded out', () => {
    const h = harness({ focused: true }); h.enter(h.first);
    assert.equal(h.first.calls.length, 0);
  }],
  ['keyboard focus cancels an in-progress fade immediately', () => {
    const h = harness(); h.enter(h.first); h.root.events.get('focusin')({ target: h.first });
    assert.ok(h.first.calls[0].cancelled);
  }],
  ['unsupported observer or animation API leaves content alone', () => {
    for (const options of [{ observer: false }, { animate: false }]) {
      const h = harness(options);
      assert.equal(h.first.calls.length, 0); assert.equal(h.intersections.length, 0);
    }
  }],
  ['missing mutation observer still supports initial content', () => {
    const h = harness({ mutation: false }); h.enter(h.first);
    assert.equal(h.first.calls.length, 1);
  }],
  ['unmount cancels active effects and removes observers/listeners', () => {
    const h = harness(); h.enter(h.first); h.cleanup();
    assert.ok(h.first.calls[0].cancelled);
    assert.ok(h.intersections[0].disconnected && h.mutations[0].disconnected);
    assert.equal(h.root.events.size, 0); assert.equal(h.listeners.size, 0);
  }],
];

for (const [name, test] of tests) { test(); console.log('PASS ' + name); }
console.log(`${tests.length} scroll-reveal hook checks passed.`);
