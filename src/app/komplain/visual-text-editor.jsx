'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Bold, Italic, Underline, List, Undo2, Redo2, AtSign, Maximize2, Check } from 'lucide-react';
import { mentionSuggestions } from '@/lib/mentions.mjs';
import { textToEditorDoc, editorDocToText, editorPlainText } from './editor-format.mjs';

const VisualTextEditor = forwardRef(function VisualTextEditor({ value = '', onChange, id, name, required, maxLength = 5000, placeholder, className = '', disabled, onFocus, mentionables }, ref) {
  const validation = useRef(null);
  const [invalid, setInvalid] = useState(false);
  // On a narrow screen, the keyboard eats most of the cramped modal — expanding to a full-screen
  // surface (same editor instance, just a different container) gives the field real room instead
  // of a few visible lines. Triggered automatically on focus there, or manually anywhere via the
  // maximize button, and never loses text since it's the same Tiptap instance either way.
  const [expanded, setExpanded] = useState(false);
  const [mentionState, setMentionStateRaw] = useState(null);
  const latest = useRef({ onChange, maxLength, mentionables, mentionState: null });
  latest.current.onChange = onChange; latest.current.maxLength = maxLength; latest.current.mentionables = mentionables;
  const setMentionState = (next) => { latest.current.mentionState = next; setMentionStateRaw(next); };
  function detectMention(current) {
    const options = latest.current.mentionables;
    if (!options?.length) return null;
    const { $from } = current.state.selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
    const suggestion = mentionSuggestions(textBefore, options);
    if (!suggestion) return null;
    return { options: suggestion.options, index: 0, from: $from.pos - suggestion.length, to: $from.pos };
  }
  function applyMention(option) {
    const state = latest.current.mentionState;
    if (!state || !editor || !option) return;
    editor.chain().focus().insertContentAt({ from: state.from, to: state.to }, { type: 'text', text: `@${option.nama} ` }).run();
    setMentionState(null);
  }
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
    editorProps: {
      attributes: { id, role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': `${id}-label`, 'aria-required': String(!!required), 'aria-describedby': `${id}-validation`, 'data-placeholder': placeholder || '', class: `visual-report-input ${className}` },
      handleKeyDown(_view, event) {
        const current = latest.current.mentionState;
        if (!current) return false;
        if (event.key === 'Escape') { setMentionState(null); return true; }
        if (!current.options.length) return false;
        if (event.key === 'ArrowDown') { setMentionState({ ...current, index: (current.index + 1) % current.options.length }); return true; }
        if (event.key === 'ArrowUp') { setMentionState({ ...current, index: (current.index - 1 + current.options.length) % current.options.length }); return true; }
        if (event.key === 'Enter' || event.key === 'Tab') { applyMention(current.options[current.index]); return true; }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => { latest.current.onChange?.({ target: { value: editorDocToText(current.getJSON()) } }); setMentionState(detectMention(current)); },
    onSelectionUpdate: ({ editor: current }) => setMentionState(detectMention(current)),
    onFocus: ({ event }) => { if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) setExpanded(true); onFocus?.(event); },
    onBlur: () => setMentionState(null),
  });
  useImperativeHandle(ref, () => editor?.view.dom || null, [editor]);
  const state = useEditorState({ editor, selector: ({ editor: current }) => current ? { bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'), bulletList: current.isActive('bulletList'), undo: current.can().undo(), redo: current.can().redo() } : {} });
  useEffect(() => {
    if (editor && editorDocToText(editor.getJSON()) !== value) editor.commands.setContent(textToEditorDoc(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setExpanded(false); } };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [expanded]);
  useEffect(() => {
    const proxy = validation.current;
    if (proxy) proxy.setCustomValidity(value.length > maxLength ? `Maksimal ${maxLength} karakter termasuk format.` : required && !editorPlainText(textToEditorDoc(value)) ? 'Isi kolom ini terlebih dahulu.' : '');
  }, [value, required, maxLength]);
  useEffect(() => { if (value.length <= maxLength && (!required || editorPlainText(textToEditorDoc(value)))) setInvalid(false); }, [value, required, maxLength]);
  const buttons = [['bold', 'Tebal', Bold, () => editor.chain().focus().toggleBold().run()], ['italic', 'Miring', Italic, () => editor.chain().focus().toggleItalic().run()], ['underline', 'Garis bawah', Underline, () => editor.chain().focus().toggleUnderline().run()], ['bulletList', 'Daftar bertitik', List, () => editor.chain().focus().toggleBulletList().run()]];
  return <div className={expanded ? 'fixed inset-0 z-[90] flex flex-col bg-slate-950 p-3 sm:p-4' : 'relative'}>
    {expanded && <p className="mb-2 shrink-0 text-sm font-semibold text-slate-200">{placeholder || 'Edit teks'}</p>}
    <div role="toolbar" aria-label="Format teks" aria-controls={id} className="mb-1.5 flex shrink-0 flex-wrap items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/60 p-1">{buttons.map(([key, label, Icon, run]) => <button key={key} type="button" aria-label={label} title={label} aria-pressed={!!state?.[key]} disabled={!editor || disabled} onMouseDown={(event) => event.preventDefault()} onClick={run} className={`inline-flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40 ${state?.[key] ? 'bg-slate-700 text-blue-200' : 'text-slate-300 hover:bg-slate-800'}`}><Icon aria-hidden="true" className="h-4 w-4" /></button>)}<span aria-hidden="true" className="mx-1 self-stretch border-l border-slate-700" />{[['undo', 'Urungkan', Undo2], ['redo', 'Ulangi', Redo2]].map(([key, label, Icon]) => <button key={key} type="button" aria-label={label} title={label} disabled={!editor || disabled || !state?.[key]} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus()[key]().run()} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-30"><Icon aria-hidden="true" className="h-4 w-4" /></button>)}<span className="flex-1" /><button type="button" aria-label={expanded ? 'Selesai, tutup area edit penuh' : 'Perbesar area edit'} title={expanded ? 'Selesai' : 'Perbesar'} onMouseDown={(event) => event.preventDefault()} onClick={() => setExpanded((value) => !value)} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${expanded ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'text-slate-300 hover:bg-slate-800'}`}>{expanded ? <><Check aria-hidden="true" className="h-4 w-4 shrink-0" />Selesai</> : <Maximize2 aria-hidden="true" className="h-4 w-4 shrink-0" />}</button></div>
    <div className={expanded ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : ''}>
    <EditorContent editor={editor} /><textarea ref={validation} name={name} aria-hidden="true" tabIndex={-1} value={value} onChange={() => {}} required={required} disabled={disabled} onInvalid={(event) => { event.preventDefault(); setInvalid(true); editor?.commands.focus(); }} className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0" /><p id={`${id}-validation`} role={invalid ? 'alert' : undefined} className="mt-1 text-xs text-red-300">{invalid ? value.length > maxLength ? `Maksimal ${maxLength} karakter termasuk format.` : 'Isi kolom ini terlebih dahulu.' : ''}</p><p className="mt-1 text-right text-xs text-slate-500">{value.length}/{maxLength}</p>
    {mentionables?.length > 0 && <div className="mt-2"><button type="button" disabled={!editor || disabled} onPointerDown={(event) => event.preventDefault()} onClick={() => { editor.chain().focus().insertContent(' @').run(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-blue-300 hover:bg-slate-800"><AtSign aria-hidden="true" className="h-4 w-4" />Sebut pengguna</button><span className="text-xs text-slate-400">atau ketik @ dan nama</span></div>}
    {mentionState && <div className="mt-2 overflow-hidden rounded-xl border border-blue-500/40 bg-slate-900 shadow-lg"><p className="border-b border-slate-700 px-3 py-2 text-xs font-medium text-slate-400">{mentionState.options.length ? 'Pilih pengguna untuk disebut' : 'Pengguna tidak ditemukan. Coba nama lain.'}</p><ul role="listbox" aria-label="Saran pengguna" className="max-h-52 overflow-y-auto">{mentionState.options.map((option, index) => <li key={option.id}><button type="button" role="option" aria-selected={index === mentionState.index} onPointerDown={(event) => event.preventDefault()} onClick={() => applyMention(option)} className={`flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm ${index === mentionState.index ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-semibold">{option.nama.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block break-words font-medium">{option.nama}</span><span className="block text-xs opacity-75">{{ admin: 'Admin', petugas: 'PIC', pelapor: 'Pelapor' }[option.role] || 'Pengguna'}</span></span></button></li>)}</ul></div>}
    </div>
  </div>;
});
export default VisualTextEditor;
