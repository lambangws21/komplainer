'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Bold, Italic, Underline, List, Undo2, Redo2 } from 'lucide-react';
import { textToEditorDoc, editorDocToText, editorPlainText } from './editor-format.mjs';

const VisualTextEditor = forwardRef(function VisualTextEditor({ value = '', onChange, id, name, required, maxLength = 5000, placeholder, className = '', disabled, onFocus }, ref) {
  const validation = useRef(null);
  const [invalid, setInvalid] = useState(false);
  const latest = useRef({ onChange, maxLength });
  latest.current = { onChange, maxLength };
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ blockquote: false, code: false, codeBlock: false, heading: false, horizontalRule: false, orderedList: false, strike: false, link: false, trailingNode: false }), Extension.create({
      name: 'reportLengthLimit',
      addProseMirrorPlugins() {
        return [new Plugin({ filterTransaction(transaction, state) {
          if (!transaction.docChanged) return true;
          const nextLength = editorDocToText(transaction.doc.toJSON()).length;
          return nextLength <= latest.current.maxLength || nextLength < editorDocToText(state.doc.toJSON()).length;
        } })];
      },
    })],
    content: textToEditorDoc(value),
    enableInputRules: false,
    editable: !disabled,
    editorProps: { attributes: { id, role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': `${id}-label`, 'aria-required': String(!!required), 'aria-describedby': `${id}-validation`, 'data-placeholder': placeholder || '', class: `visual-report-input ${className}` } },
    onUpdate: ({ editor: current }) => latest.current.onChange?.({ target: { value: editorDocToText(current.getJSON()) } }),
    onFocus: ({ event }) => onFocus?.(event),
  });
  useImperativeHandle(ref, () => editor?.view.dom || null, [editor]);
  const state = useEditorState({ editor, selector: ({ editor: current }) => current ? { bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'), bulletList: current.isActive('bulletList'), undo: current.can().undo(), redo: current.can().redo() } : {} });
  useEffect(() => {
    if (editor && editorDocToText(editor.getJSON()) !== value) editor.commands.setContent(textToEditorDoc(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  useEffect(() => {
    const proxy = validation.current;
    if (proxy) proxy.setCustomValidity(value.length > maxLength ? `Maksimal ${maxLength} karakter termasuk format.` : required && !editorPlainText(textToEditorDoc(value)) ? 'Isi kolom ini terlebih dahulu.' : '');
  }, [value, required, maxLength]);
  useEffect(() => { if (value.length <= maxLength && (!required || editorPlainText(textToEditorDoc(value)))) setInvalid(false); }, [value, required, maxLength]);
  const buttons = [['bold', 'Tebal', Bold, () => editor.chain().focus().toggleBold().run()], ['italic', 'Miring', Italic, () => editor.chain().focus().toggleItalic().run()], ['underline', 'Garis bawah', Underline, () => editor.chain().focus().toggleUnderline().run()], ['bulletList', 'Daftar bertitik', List, () => editor.chain().focus().toggleBulletList().run()]];
  return <div className="relative"><div role="toolbar" aria-label="Format teks" aria-controls={id} className="mb-1.5 flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-950/60 p-1">{buttons.map(([key, label, Icon, run]) => <button key={key} type="button" aria-label={label} title={label} aria-pressed={!!state?.[key]} disabled={!editor || disabled} onMouseDown={(event) => event.preventDefault()} onClick={run} className={`inline-flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40 ${state?.[key] ? 'bg-slate-700 text-blue-200' : 'text-slate-300 hover:bg-slate-800'}`}><Icon aria-hidden="true" className="h-4 w-4" /></button>)}<span aria-hidden="true" className="mx-1 self-stretch border-l border-slate-700" />{[['undo', 'Urungkan', Undo2], ['redo', 'Ulangi', Redo2]].map(([key, label, Icon]) => <button key={key} type="button" aria-label={label} title={label} disabled={!editor || disabled || !state?.[key]} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus()[key]().run()} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-30"><Icon aria-hidden="true" className="h-4 w-4" /></button>)}</div><EditorContent editor={editor} /><textarea ref={validation} name={name} aria-hidden="true" tabIndex={-1} value={value} onChange={() => {}} required={required} disabled={disabled} onInvalid={(event) => { event.preventDefault(); setInvalid(true); editor?.commands.focus(); }} className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0" /><p id={`${id}-validation`} role={invalid ? 'alert' : undefined} className="mt-1 text-xs text-red-300">{invalid ? value.length > maxLength ? `Maksimal ${maxLength} karakter termasuk format.` : 'Isi kolom ini terlebih dahulu.' : ''}</p><p className="mt-1 text-right text-xs text-slate-500">{value.length}/{maxLength}</p></div>;
});
export default VisualTextEditor;
