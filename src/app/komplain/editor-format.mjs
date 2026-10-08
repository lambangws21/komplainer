import { parseInline, MARKERS } from './rich-text.mjs';

function inlineNodes(text) {
  return parseInline(text).filter((segment) => segment.text).map((segment) => ({ type: 'text', text: segment.text, ...(['bold', 'italic', 'underline'].some((mark) => segment[mark]) ? { marks: ['bold', 'italic', 'underline'].filter((mark) => segment[mark]).map((type) => ({ type })) } : {}) }));
}
export function textToEditorDoc(value) {
  const content = [];
  let list = null;
  for (const line of String(value || '').split('\n')) {
    const listed = /^-\s+/.test(line);
    const paragraph = { type: 'paragraph', content: inlineNodes(listed ? line.replace(/^-\s+/, '') : line) };
    if (listed) {
      if (!list) { list = { type: 'bulletList', content: [] }; content.push(list); }
      list.content.push({ type: 'listItem', content: [paragraph] });
    } else { list = null; content.push(paragraph); }
  }
  return { type: 'doc', content };
}
function inlineText(node) {
  if (node.type === 'hardBreak') return '\n';
  if (node.type !== 'text') return (node.content || []).map(inlineText).join('');
  let text = node.text || '';
  // Deterministic nesting lets combined marks round-trip through the existing text API.
  for (const mark of ['underline', 'italic', 'bold']) if (node.marks?.some((item) => item.type === mark) && text) text = `${MARKERS[mark]}${text}${MARKERS[mark]}`;
  return text;
}
function blockLines(node) {
  if (node.type === 'bulletList' || node.type === 'orderedList') return (node.content || []).flatMap((item) => (item.content || []).flatMap(blockLines).map((line) => `- ${line}`));
  return inlineText(node).split('\n');
}
export function editorDocToText(doc) {
  return (doc.content || []).flatMap(blockLines).join('\n');
}
export function editorPlainText(doc) {
  const walk = (node) => node.type === 'text' ? node.text || '' : (node.content || []).map(walk).join(node.type === 'paragraph' ? '' : '\n');
  return walk(doc).trim();
}
