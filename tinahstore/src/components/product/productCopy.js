// Admin fields are plain text, not trusted HTML or rich-text markup. Recognize
// line-based lists without splitting sentences, decimals, or measurement text.
export function parseProductCopy(text) {
  if (typeof text !== 'string') return [];
  const blocks = [];
  let active = null;
  let afterBlank = false;

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      if (active?.type === 'paragraph') active = null;
      afterBlank = true;
      continue;
    }
    const marker = line.match(/^(?:(\d{1,9})[.)]|[-*\u2022])[ \t]+(.+)$/);
    if (marker) {
      const type = marker[1] === undefined ? 'unordered' : 'ordered';
      if (active?.type !== type) {
        active = { type, items: [] };
        blocks.push(active);
      }
      active.items.push({ text: marker[2], ...(type === 'ordered' ? { number: Number(marker[1]) } : {}) });
    } else if (active?.items && !afterBlank && /^(?: {2,}|\t)\S/.test(raw)) {
      active.items.at(-1).text += `\n${line}`;
    } else {
      if (active?.type !== 'paragraph') {
        active = { type: 'paragraph', text: '' };
        blocks.push(active);
      }
      active.text += `${active.text ? '\n' : ''}${line}`;
    }
    afterBlank = false;
  }
  return blocks;
}
