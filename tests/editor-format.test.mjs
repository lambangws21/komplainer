import test from 'node:test';
import assert from 'node:assert/strict';
import { textToEditorDoc, editorDocToText, editorPlainText } from '../src/app/komplain/editor-format.mjs';
import { parseInline } from '../src/app/komplain/rich-text.mjs';
test('visual editor round-trips existing formatting, lines and lists', () => {
  for (const value of ['', 'Masalah\n\nSolusi', '**tebal** dan __miring__ serta ++garis bawah++', '- **pertama**\n- __kedua__\nselesai', '<script>alert(1)</script>', 'teks & simbol > biasa']) assert.equal(editorDocToText(textToEditorDoc(value)), value);
});
test('combined marks remain visual in previews and restored drafts', () => {
  const value = '**__++gabungan++__**';
  assert.deepEqual(parseInline(value), [{ text: 'gabungan', bold: true, italic: true, underline: true }]);
  assert.equal(editorDocToText(textToEditorDoc(value)), value);
  assert.equal(editorPlainText(textToEditorDoc(value)), 'gabungan');
});
test('hard breaks and lists serialize into existing plain-text API', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Satu' }, { type: 'hardBreak' }, { type: 'text', text: 'Dua', marks: [{ type: 'bold' }] }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tiga' }] }] }] }] };
  assert.equal(editorDocToText(doc), 'Satu\n**Dua**\n- Tiga');
  assert.equal(editorPlainText(textToEditorDoc(' \n- ')), '');
});
