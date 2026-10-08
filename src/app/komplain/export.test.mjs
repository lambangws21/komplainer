import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportsToCsv, groupRecap, recapToCsv } from './export.mjs';

test('reportsToCsv includes a BOM, escapes commas/quotes/newlines, and detects implants', () => {
  const rows = [{
    tanggal: '2026-10-08', dokter: 'dr. A', rumahSakit: 'RS, Harapan', team: 'TS', tindakan: 'TKR Zimmer',
    komplain: 'Ada "kendala"\nserius', jalanKeluar: '', penangananSelanjutnya: '', statusCase: 'Ada Kendala',
    status: 'C1 - Critical', statusPenanganan: 'Baru', picNama: '', tenggat: '', pelaporNama: 'Budi',
  }];
  const csv = reportsToCsv(rows);
  assert.ok(csv.startsWith('﻿Tanggal,'));
  assert.ok(csv.includes('"RS, Harapan"'));
  assert.ok(csv.includes('"Ada ""kendala""\nserius"'));
  assert.ok(csv.includes('Zimmer'));
});

test('groupRecap tallies Total/Sukses/Ada Kendala per group, sorted by total, with a fallback for blank keys', () => {
  const rows = [
    { team: 'Andri', statusCase: 'Sukses' },
    { team: 'Andri', statusCase: 'Ada Kendala' },
    { team: 'Dunna', statusCase: 'Ada Kendala' },
    { team: '  ', statusCase: 'Sukses' },
  ];
  const groups = groupRecap(rows, 'team');
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0], { key: 'Andri', total: 2, sukses: 1, kendala: 1 });
  assert.ok(groups.some((g) => g.key === 'Belum diisi' && g.total === 1));
});

test('recapToCsv renders the same grouping as a CSV with a Total/Sukses/Ada Kendala header', () => {
  const rows = [{ tindakan: 'TKR ROSA', statusCase: 'Ada Kendala' }, { tindakan: 'TKR ROSA', statusCase: 'Sukses' }];
  const csv = recapToCsv(rows, 'tindakan', 'Tindakan');
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '﻿Tindakan,Total Case,Sukses,Ada Kendala');
  assert.equal(lines[1], 'TKR ROSA,2,1,1');
});
