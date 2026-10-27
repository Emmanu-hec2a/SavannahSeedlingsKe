import assert from 'node:assert/strict';
import { collectPages } from '../src/services/pagination.js';

const tests = [
  ['collects every page with the original filters', async () => {
    const calls = [];
    const rows = await collectPages(async params => {
      calls.push(params);
      return params.page === 1
        ? { results: [{ id: 1 }], next: 'https://api.example/products/?page=2&ordering=-created_at' }
        : { results: [{ id: 2 }], next: null };
    }, { ordering: '-created_at', category: 'citrus' });
    assert.deepEqual(rows, [{ id: 1 }, { id: 2 }]);
    assert.deepEqual(calls, [1, 2].map(page => ({ ordering: '-created_at', category: 'citrus', page })));
  }],
  ['never forwards a server-provided origin or injected filters', async () => {
    const calls = [];
    await collectPages(async params => {
      calls.push(params);
      return params.page === 1 ? { results: [{ id: 1 }], next: 'https://untrusted.invalid/?page=2&category=other' } : [];
    }, { category: 'citrus' });
    assert.deepEqual(calls[1], { category: 'citrus', page: 2 });
  }],
  ['supports unpaginated list responses', async () => {
    assert.deepEqual(await collectPages(async () => [{ id: 1 }]), [{ id: 1 }]);
  }],
  ['supports an empty catalog', async () => {
    assert.deepEqual(await collectPages(async () => ({ results: [], next: null })), []);
  }],
  ['featured products stop after their display limit', async () => {
    let calls = 0;
    const rows = await collectPages(async () => {
      calls++;
      return { results: Array.from({ length: 12 }, (_, id) => ({ id })), next: '?page=2' };
    }, {}, { limit: 4 });
    assert.equal(calls, 1);assert.equal(rows.length, 4);
  }],
  ['rejects a failed later page instead of returning a partial catalog', async () => {
    await assert.rejects(collectPages(async ({ page }) => {
      if (page === 2) throw Error('Service unavailable');
      return { results: [{ id: 1 }], next: '?page=2' };
    }), /Service unavailable/);
  }],
  ['rejects repeated pages', async () => {
    await assert.rejects(collectPages(async () => ({ results: [{ id: 1 }], next: '?page=1' })), /repeated/);
  }],
  ['rejects missing or invalid page numbers', async () => {
    for (const next of ['?page=abc', '?page=2.5', '?page=-1', '?category=citrus']) {
      await assert.rejects(collectPages(async () => ({ results: [{ id: 1 }], next })));
    }
  }],
  ['rejects malformed lists', async () => {
    await assert.rejects(collectPages(async () => ({ detail: 'Not a list' })), /invalid list/);
  }],
  ['rejects empty intermediate pages', async () => {
    await assert.rejects(collectPages(async () => ({ results: [], next: '?page=2' })), /incomplete/);
  }],
  ['deduplicates records repeated across pages', async () => {
    const rows = await collectPages(async ({ page }) => page === 1
      ? { results: [{ id: 1 }], next: '?page=2' }
      : { results: [{ id: 1 }, { id: 2 }], next: null });
    assert.deepEqual(rows, [{ id: 1 }, { id: 2 }]);
  }],
  ['passes cancellation to every page request', async () => {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(collectPages(async (_, { signal }) => {
      calls++;assert.equal(signal, controller.signal);controller.abort();
      return { results: [{ id: 1 }], next: '?page=2' };
    }, {}, { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(calls, 1);
  }],
];

for (const [name, run] of tests) {
  await run();
  console.log('PASS ' + name);
}
console.log(`${tests.length} catalog pagination checks passed.`);
