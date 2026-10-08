import test from 'node:test';
import assert from 'node:assert/strict';
import { historyChanges, historyFieldLabel, formatHistoryValue } from '../src/app/komplain/workflow.mjs';

test('history supports content snapshots and legacy entries without inventing old values', () => {
  const changes = historyChanges(JSON.stringify({ before: { dokter: 'Awal', komplain: '', status: '' }, after: { dokter: 'Baru', komplain: 'Masalah baru', status: '' } }));
  assert.deepEqual(changes.map((change) => change.key), ['dokter', 'komplain']);
  assert.equal(historyFieldLabel('team'), 'Team Pelapor');
  assert.equal(formatHistoryValue('komplain', '', [], String), 'Belum diisi');
  assert.equal(formatHistoryValue('status', 'Unknown', [], String), 'Unknown');
  assert.deepEqual(historyChanges(JSON.stringify({ fields: ['dokter'] })), []);
  assert.deepEqual(historyChanges('invalid'), []);
});
