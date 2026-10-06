import { parseInline } from './rich-text.mjs';

function Segment({ seg }) {
  let node = seg.text;
  if (seg.bold) node = <strong>{node}</strong>;
  if (seg.italic) node = <em>{node}</em>;
  if (seg.underline) node = <u>{node}</u>;
  return node;
}

function renderInline(text) {
  return parseInline(text).map((seg, index) => <Segment key={index} seg={seg} />);
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
