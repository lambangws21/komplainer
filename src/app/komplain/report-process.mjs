// Old reports used jalanKeluar for both concepts. Only infer an initial solution
// before handling begins; never present a reporter's initial suggestion as a result.
export const initialSolution = (item = {}) => item?.solusiAwal ?? (item?.statusPenanganan === 'Baru' || !item?.statusPenanganan ? item?.jalanKeluar || '' : '');
export const handlingSolution = (item = {}) => item?.statusPenanganan === 'Baru' || !item?.statusPenanganan ? '' : item?.jalanKeluar || '';
export function handlingDraft(item) {
  return { picId: item.picId || '', tenggat: item.tenggat || '', statusPenanganan: item.statusPenanganan === 'Menunggu' ? 'Menunggu' : 'Diproses', jalanKeluar: handlingSolution(item), penangananSelanjutnya: item.penangananSelanjutnya || '', status: item.status || '', catatan: '' };
}
// Adopt remote updates for untouched fields; retain local edits and flag overlap.
export function mergeEditable(base, local, latest) {
  const conflicts = [];
  const merged = Object.fromEntries(Object.entries(local).map(([key, value]) => {
    if (value === base[key]) return [key, latest[key] ?? value];
    if (latest[key] !== base[key] && latest[key] !== value) conflicts.push({ key, local: value, latest: latest[key] ?? '' });
    return [key, value];
  }));
  return { merged, conflicts };
}
