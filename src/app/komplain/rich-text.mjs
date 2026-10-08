export const MARKERS = { bold: '**', italic: '__', underline: '++' };

export function wrapSelection(textarea, value, onChange, marker) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  const wrapped = selected && value.slice(start - marker.length, start) === marker && value.slice(end, end + marker.length) === marker;
  let next, caretStart, caretEnd;
  if (wrapped) {
    next = value.slice(0, start - marker.length) + selected + value.slice(end + marker.length);
    caretStart = start - marker.length; caretEnd = caretStart + selected.length;
  } else {
    const inner = selected || 'teks';
    next = `${value.slice(0, start)}${marker}${inner}${marker}${value.slice(end)}`;
    caretStart = start + marker.length; caretEnd = caretStart + inner.length;
  }
  onChange(next);
  requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(caretStart, caretEnd); });
}

export function toggleListLines(textarea, value, onChange) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? value.length;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const nonEmpty = lines.filter((line) => line.trim() !== '');
  const allListed = nonEmpty.length > 0 && nonEmpty.every((line) => /^-\s/.test(line));
  const nextLines = lines.map((line) => {
    if (line.trim() === '') return line;
    if (allListed) return line.replace(/^-\s/, '');
    return /^-\s/.test(line) ? line : `- ${line}`;
  });
  const nextBlock = nextLines.join('\n');
  const next = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
  onChange(next);
  requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(lineStart, lineStart + nextBlock.length); });
}

const INLINE_PATTERN = /(\*\*(.+?)\*\*)|(\+\+(.+?)\+\+)|(__(.+?)__)/;

export function parseInline(text, inherited = {}) {
  const segments = [];
  let remaining = String(text ?? '');
  while (remaining.length) {
    const match = INLINE_PATTERN.exec(remaining);
    if (!match) { segments.push({ text: remaining, ...inherited }); break; }
    if (match.index > 0) segments.push({ text: remaining.slice(0, match.index), ...inherited });
    const mark = match[1] ? 'bold' : match[3] ? 'underline' : 'italic';
    const inner = match[2] ?? match[4] ?? match[6];
    segments.push(...parseInline(inner, { ...inherited, [mark]: true }));
    remaining = remaining.slice(match.index + match[0].length);
  }
  return segments;
}
