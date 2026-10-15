import { Fragment, type ReactNode } from 'react';

/**
 * Renders the small Markdown subset used by content pages (## headings, paragraphs,
 * "- " lists, **bold**, *italic*). Builds React elements — never injects HTML, so it is XSS-safe.
 */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-medium text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);
  return (
    <div className="prose-silt">
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) return <h2 key={i}>{inline(block.slice(3))}</h2>;
        const lines = block.split('\n');
        if (lines.every((l) => l.startsWith('- ')))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        return <p key={i}>{inline(lines.join(' '))}</p>;
      })}
    </div>
  );
}
