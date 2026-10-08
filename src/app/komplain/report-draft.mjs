const key = (id) => `komplainer:report-draft:${id}`;
export function readDraft(storage, id) {
  try {
    if (!id) return null;
    const draft = JSON.parse(storage.getItem(key(id)) || 'null');
    if (!draft || typeof draft.form !== 'object' || !draft.form || typeof draft.requestId !== 'string') return null;
    const names = ['tanggal', 'dokter', 'rumahSakit', 'team', 'tindakan', 'komplain', 'jalanKeluar', 'penangananSelanjutnya', 'statusCase'];
    return { form: Object.fromEntries(names.filter((name) => typeof draft.form[name] === 'string').map((name) => [name, draft.form[name]])), requestId: draft.requestId };
  } catch { return null; }
}
export function writeDraft(storage, id, form, requestId) {
  try { if (id) storage.setItem(key(id), JSON.stringify({ form, requestId })); } catch { /* Storage may be unavailable or full. */ }
}
export function clearDraft(storage, id) {
  try { if (id) storage.removeItem(key(id)); } catch { /* Optional local persistence. */ }
}
