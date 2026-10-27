// Follow Django page numbers, never a server-provided origin with credentials.
// Keep the original filters on every request and reject incomplete/malformed lists.
export async function collectPages(fetchPage, params = {}, { signal, limit = Infinity } = {}) {
  const items = [];
  const ids = new Set();
  const pages = new Set();
  let page = Number(params.page || 1);
  while (true) {
    if (!Number.isSafeInteger(page) || page < 1 || pages.has(page)) {
      throw new Error('The catalog returned an invalid pagination link.');
    }
    pages.add(page);
    signal?.throwIfAborted();
    const data = await fetchPage({ ...params, page }, { signal });
    const rows = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(rows)) throw new Error('The catalog returned an invalid list.');
    for (const row of rows) {
      if (row.id != null && ids.has(row.id)) continue;
      if (row.id != null) ids.add(row.id);
      items.push(row);
    }
    if (items.length >= limit || Array.isArray(data) || !data.next) return items.slice(0, limit);
    if (!rows.length) throw new Error('The catalog returned an incomplete page.');
    const nextPage = Number(new URL(data.next, 'https://pagination.invalid/').searchParams.get('page'));
    if (nextPage <= page) throw new Error('The catalog returned a repeated pagination link.');
    page = nextPage;
  }
}
