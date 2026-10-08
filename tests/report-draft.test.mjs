import test from 'node:test';
import assert from 'node:assert/strict';
import { readDraft, writeDraft, clearDraft } from '../src/app/komplain/report-draft.mjs';
test('drafts isolate users, preserve retry ID and clear only current user', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  writeDraft(storage, 'a', { dokter: 'Dokter A', komplain: 'Masalah' }, 'retry-a');
  writeDraft(storage, 'b', { dokter: 'Dokter B' }, 'retry-b');
  assert.equal(readDraft(storage, 'a').requestId, 'retry-a');
  clearDraft(storage, 'a');
  assert.equal(readDraft(storage, 'a'), null);
  assert.equal(readDraft(storage, 'b').form.dokter, 'Dokter B');
});
test('corrupt or unavailable storage does not break form', () => {
  assert.equal(readDraft({ getItem: () => '{broken' }, 'a'), null);
  const denied = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  assert.equal(readDraft(denied, 'a'), null);
  assert.doesNotThrow(() => writeDraft(denied, 'a', {}, 'id'));
  assert.doesNotThrow(() => clearDraft(denied, 'a'));
});
