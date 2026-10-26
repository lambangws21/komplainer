import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReportSummary } from '../src/lib/server/home-summary-core.mjs';

function report(overrides) {
  return { id: 'r1', pelaporId: 'p1', picId: null, statusPenanganan: 'Baru', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', ...overrides };
}

test('a report shown in "Perlu tindakan Anda" is excluded from the Beranda feed, not duplicated', () => {
  const admin = { id: 'admin1', role: 'admin' };
  const unassigned = report({ id: 'r1', picId: null });
  const other = report({ id: 'r2', picId: 'pic1', statusPenanganan: 'Diproses' });
  const summary = computeReportSummary([unassigned, other], admin);
  assert.deepEqual(summary.attention.map((item) => item.id), ['r1']);
  assert.ok(!summary.latest.items.some((item) => item.id === 'r1'), 'attention item must not also appear in the feed');
  assert.deepEqual(summary.latest.items.map((item) => item.id).sort(), ['r2']);
});

test('petugas attention is scoped to their own PIC cases, admin attention covers unassigned and Menunggu', () => {
  const petugas = { id: 'pic1', role: 'petugas' };
  const mine = report({ id: 'r1', picId: 'pic1', statusPenanganan: 'Diproses' });
  const someoneElses = report({ id: 'r2', picId: 'pic2', statusPenanganan: 'Diproses' });
  const summary = computeReportSummary([mine, someoneElses], petugas);
  assert.deepEqual(summary.attention.map((item) => item.id), ['r1']);
});

test('myComplaints covers PIC cases for petugas and reported cases for pelapor/admin', () => {
  const data = [report({ id: 'r1', pelaporId: 'reporter1', picId: 'pic1' }), report({ id: 'r2', pelaporId: 'reporter1', picId: null })];
  const petugas = computeReportSummary(data, { id: 'pic1', role: 'petugas' });
  assert.deepEqual(petugas.myComplaints.map((item) => item.id), ['r1']);
  const pelapor = computeReportSummary(data, { id: 'reporter1', role: 'pelapor' });
  assert.deepEqual(pelapor.myComplaints.map((item) => item.id).sort(), ['r1', 'r2']);
  const admin = computeReportSummary(data, { id: 'reporter1', role: 'admin' });
  assert.deepEqual(admin.myComplaints.map((item) => item.id).sort(), ['r1', 'r2']);
});

test('incoming queue only applies to petugas and only lists unassigned, still-open reports', () => {
  const data = [report({ id: 'r1', picId: null, statusPenanganan: 'Baru' }), report({ id: 'r2', picId: null, statusPenanganan: 'Selesai' }), report({ id: 'r3', picId: 'pic1', statusPenanganan: 'Baru' })];
  const petugas = computeReportSummary(data, { id: 'pic1', role: 'petugas' });
  assert.deepEqual(petugas.incoming.map((item) => item.id), ['r1']);
  const admin = computeReportSummary(data, { id: 'admin1', role: 'admin' });
  assert.deepEqual(admin.incoming, []);
});

test('stale only applies to admin and only flags active reports untouched for more than three days', () => {
  const now = Date.now();
  const stale = report({ id: 'r1', picId: 'pic1', statusPenanganan: 'Diproses', updatedAt: new Date(now - 4 * 86400000).toISOString() });
  const fresh = report({ id: 'r2', picId: 'pic1', statusPenanganan: 'Diproses', updatedAt: new Date(now - 1 * 86400000).toISOString() });
  const admin = computeReportSummary([stale, fresh], { id: 'admin1', role: 'admin' });
  assert.deepEqual(admin.stale.map((item) => item.id), ['r1']);
  const petugas = computeReportSummary([stale, fresh], { id: 'pic1', role: 'petugas' });
  assert.deepEqual(petugas.stale, []);
});

test('latest feed paginates with cursor/limit and reports a stable total and nextCursor', () => {
  const data = Array.from({ length: 5 }, (_, index) => report({ id: `r${index}`, picId: 'pic1', statusPenanganan: 'Diproses', createdAt: new Date(2024, 0, index + 1).toISOString() }));
  const admin = { id: 'admin1', role: 'admin' };
  const first = computeReportSummary(data, admin, { cursor: 0, limit: 2 });
  assert.equal(first.latest.items.length, 2);
  assert.equal(first.latest.total, 5);
  assert.equal(first.latest.nextCursor, 2);
  const last = computeReportSummary(data, admin, { cursor: 4, limit: 2 });
  assert.equal(last.latest.items.length, 1);
  assert.equal(last.latest.nextCursor, null);
});
