import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementRecipientIds, pushTargetsForMutation } from '../src/lib/server/push.mjs';

const accounts = [
  { id: 'admin1', role: 'admin', active: true },
  { id: 'petugas1', role: 'petugas', active: true },
  { id: 'petugas-inactive', role: 'petugas', active: false },
  { id: 'pelapor1', role: 'pelapor', active: true },
];

test('a new report pushes to every active admin/petugas regardless of statusCase, skipping inactive and pelapor accounts', () => {
  const item = { dokter: 'dr. Andi', rumahSakit: 'RS Harapan', statusCase: 'Ada Kendala' };
  const targets = pushTargetsForMutation('create', item, [], accounts);
  assert.deepEqual(targets.map((t) => t.userId).sort(), ['admin1', 'petugas1']);
  assert.match(targets[0].body, /dr\. Andi/);
});

test('a new "Sukses" report also pushes to every active admin/petugas', () => {
  const item = { dokter: 'dr. Andi', rumahSakit: 'RS Harapan', statusCase: 'Sukses' };
  const targets = pushTargetsForMutation('create', item, [], accounts);
  assert.deepEqual(targets.map((t) => t.userId).sort(), ['admin1', 'petugas1']);
});

test('a new report created by an admin/petugas does not push to the creator themselves', () => {
  const item = { dokter: 'dr. Andi', rumahSakit: 'RS Harapan', statusCase: 'Ada Kendala', pelaporId: 'petugas1' };
  const targets = pushTargetsForMutation('create', item, [], accounts);
  assert.deepEqual(targets.map((t) => t.userId), ['admin1']);
});

test('assigning a PIC pushes to the PIC and reporter', () => {
  const item = { picId: 'petugas1', picNama: 'Budi', pelaporId: 'pelapor1' };
  const targets = pushTargetsForMutation('assign', item, [], accounts);
  assert.deepEqual(targets, [
    { userId: 'petugas1', title: 'Tugas komplain baru', body: 'Dokter · RS', url: '/komplain' },
    { userId: 'pelapor1', title: 'Laporan Anda ditugaskan', body: 'PIC: Budi', url: '/komplain' },
  ]);
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
  // Assignment notifies PIC and reporter; the new mention is also delivered to its recipient.
  assert.deepEqual(targets.map((target) => target.userId), ['petugas1', 'pelapor1', 'pelapor1']);
});

test('announcements push only to active accounts in the selected audience, excluding the author', () => {
  assert.deepEqual(announcementRecipientIds({ audience: 'all', createdBy: 'admin1' }, accounts), ['petugas1', 'pelapor1']);
  assert.deepEqual(announcementRecipientIds({ audience: 'petugas', createdBy: 'admin1' }, accounts), ['petugas1']);
  assert.deepEqual(announcementRecipientIds({ audience: 'users', createdBy: 'admin1', recipientIds: ['petugas1', 'pelapor1', 'missing'] }, accounts), ['petugas1', 'pelapor1']);
});
