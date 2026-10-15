import test from 'node:test';
import assert from 'node:assert/strict';
import { pushTargetsForMutation } from '../src/lib/server/push.mjs';

const accounts = [
  { id: 'admin1', role: 'admin', active: true },
  { id: 'petugas1', role: 'petugas', active: true },
  { id: 'petugas-inactive', role: 'petugas', active: false },
  { id: 'pelapor1', role: 'pelapor', active: true },
];

test('a new "Ada Kendala" report pushes to every active admin/petugas, skipping inactive and pelapor accounts', () => {
  const item = { dokter: 'dr. Andi', rumahSakit: 'RS Harapan', statusCase: 'Ada Kendala' };
  const targets = pushTargetsForMutation('create', item, [], accounts);
  assert.deepEqual(targets.map((t) => t.userId).sort(), ['admin1', 'petugas1']);
  assert.match(targets[0].body, /dr\. Andi/);
});

test('a new "Sukses" report pushes to no one', () => {
  const item = { dokter: 'dr. Andi', rumahSakit: 'RS Harapan', statusCase: 'Sukses' };
  assert.deepEqual(pushTargetsForMutation('create', item, [], accounts), []);
});

test('assigning a PIC pushes to the reporter only', () => {
  const item = { picId: 'petugas1', picNama: 'Budi', pelaporId: 'pelapor1' };
  const targets = pushTargetsForMutation('assign', item, [], accounts);
  assert.deepEqual(targets, [{ userId: 'pelapor1', title: 'Laporan Anda ditugaskan', body: 'PIC: Budi', url: '/komplain' }]);
});

test('clearing a PIC (no picId) pushes to no one', () => {
  const item = { picId: '', pelaporId: 'pelapor1' };
  assert.deepEqual(pushTargetsForMutation('assign', item, [], accounts), []);
});

test('mentions push to each mentioned user regardless of action', () => {
  const item = { dokter: 'dr. Andi', rumahSakit: 'RS Harapan' };
  const targets = pushTargetsForMutation('followUp', item, ['admin1', 'pelapor1'], accounts);
  assert.deepEqual(targets.map((t) => t.userId).sort(), ['admin1', 'pelapor1']);
});

test('a follow-up update pushes to the reporter, with wording depending on completion', () => {
  const inProgress = { dokter: 'dr. Andi', rumahSakit: 'RS Harapan', pelaporId: 'pelapor1', statusPenanganan: 'Diproses' };
  assert.deepEqual(pushTargetsForMutation('followUp', inProgress, [], accounts), [{ userId: 'pelapor1', title: 'Ada update penanganan laporan Anda', body: 'dr. Andi · RS Harapan', url: '/komplain' }]);
  const done = { ...inProgress, statusPenanganan: 'Selesai' };
  assert.equal(pushTargetsForMutation('followUp', done, [], accounts)[0].title, 'Laporan Anda selesai ditangani');
});

test('a follow-up with no reporter on record pushes to no one', () => {
  assert.deepEqual(pushTargetsForMutation('followUp', { dokter: 'dr. Andi' }, [], accounts), []);
});

test('a create + assign + mention can all fire together without duplicating unrelated targets', () => {
  const item = { dokter: 'dr. Andi', rumahSakit: 'RS Harapan', statusCase: 'Ada Kendala', picId: 'petugas1', picNama: 'Budi', pelaporId: 'pelapor1' };
  const targets = pushTargetsForMutation('assign', item, ['pelapor1'], accounts);
  // assign -> pelapor1, plus the same pelapor1 mentioned -> two separate notifications, not deduped
  assert.equal(targets.length, 2);
  assert.ok(targets.every((t) => t.userId === 'pelapor1'));
});
