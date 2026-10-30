import { useMemo } from 'react';
import { parseProductCopy } from './productCopy.js';

export default function ProductCopy({ text, className = '' }) {
  const blocks = useMemo(() => parseProductCopy(text), [text]);
  if (!blocks.length) return null;

  return (
    <div className={`product-copy ${className}`.trim()}>
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') return <p key={index}>{block.text}</p>;
        if (block.type === 'ordered') {
          return (
            <ol key={index} start={block.items[0].number}>
              {block.items.map((item, itemIndex) => <li key={itemIndex} value={item.number}>{item.text}</li>)}
            </ol>
          );
        }
        return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item.text}</li>)}</ul>;
      })}
    </div>
  );
}
