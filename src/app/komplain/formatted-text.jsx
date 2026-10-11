import { parseInline } from './rich-text.mjs';

// Cosmetic-only: highlights "@Full Name"-looking text without validating against the live
// account directory, so rendering stays simple everywhere this component already appears.
const MENTION_REGEX = /@[A-Za-z][A-Za-z.'-]*(?:\s[A-Za-z][A-Za-z.'-]*){0,4}/g;
function renderMentions(text, keyPrefix) {
  const parts = []; let last = 0; let match; let index = 0;
  const regex = new RegExp(MENTION_REGEX);
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(<span key={`${keyPrefix}-${index++}`} className="rounded bg-blue-500/15 px-1 font-medium text-blue-300">{match[0]}</span>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}
function Segment({ seg, keyPrefix }) {
  let node = renderMentions(seg.text, keyPrefix);
  if (seg.bold) node = <strong>{node}</strong>;
  if (seg.italic) node = <em>{node}</em>;
  if (seg.underline) node = <u>{node}</u>;
  return node;
}

function renderInline(text) {
  return parseInline(text).map((seg, index) => <Segment key={index} seg={seg} keyPrefix={index} />);
}

// For truncated one-line previews (table rows, cards) where block/list layout would break line-clamp.
export function InlineText({ text }) {
  return renderInline(String(text ?? ''));
}

export default function FormattedText({ text, className = '' }) {
  const raw = String(text ?? '');
  if (!raw.trim()) return null;
  const lines = raw.split('\n');
  const blocks = [];
  let currentList = null;
  for (const line of lines) {
    if (/^-\s+/.test(line)) {
      if (!currentList) { currentList = []; blocks.push({ type: 'list', items: currentList }); }
      currentList.push(line.replace(/^-\s+/, ''));
    } else {
      currentList = null;
      blocks.push({ type: 'line', text: line });
    }
  }
  return <div className={`space-y-1.5 ${className}`}>{blocks.map((block, index) => block.type === 'list'
    ? <ul key={index} className="ml-4 list-disc space-y-0.5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>
    : <p key={index} className="whitespace-pre-wrap break-words leading-6">{block.text ? renderInline(block.text) : ' '}</p>)}
  </div>;
}
