import { ApiError } from './api-error.mjs';
import { createHash } from 'node:crypto';
import { newMentions } from '../mentions.mjs';
export const REPORTS = 'komplainer_reports';
export const BACKUPS = 'komplainer_backup_jobs';
export const MENTIONS = 'komplainer_mentions';
export const REACTION_NOTICES = 'komplainer_reaction_notices';
export const mentionId = (reportId, userId) => createHash('sha256').update(`mention:${reportId}:${userId}`).digest('hex');
// One doc per (report, target, reactor) triple — upserted, not appended, so a reactor flipping
// like<->love collapses into a single evolving notice instead of spamming the target's feed, and
// taking the reaction back removes it entirely (see the 'react' action in firestore-store.mjs).
export const reactionNoticeId = (reportId, targetUserId, byUserId) => createHash('sha256').update(`reaction:${reportId}:${targetUserId}:${byUserId}`).digest('hex');
export const backupId = (id, version) => createHash('sha256').update(`${id}:${version}`).digest('hex');
export function validId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new ApiError('ID laporan tidak valid.');
  return value;
}
export function text(value, label, required = false, max = 200) {
  if (value != null && typeof value !== 'string') throw new ApiError(`${label} tidak valid.`);
  const result = (value || '').trim();
  if (required && !result) throw new ApiError(`${label} wajib diisi.`);
  if (result.length > max) throw new ApiError(`${label} terlalu panjang.`);
  return result;
}
export function date(value, optional = false) {
  if (!value && optional) return '';
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new ApiError('Tanggal tidak valid.');
  return value;
}
const levels = ['C1 - Critical', 'C2 - Major', 'C3 - Moderate', 'C4 - Minor'];
const contents = ['tanggal', 'dokter', 'rumahSakit', 'team', 'tindakan', 'komplain', 'jalanKeluar', 'penangananSelanjutnya', 'solusiAwal'];
const snapshot = (item) => Object.fromEntries([...contents, 'statusPenanganan', 'picId', 'picNama', 'tenggat', 'status', 'statusCase'].map((key) => [key, item[key] || '']));
function content(body, completed = false) {
  if (!['Sukses', 'Ada Kendala'].includes(body.statusCase)) throw new ApiError('Kondisi kasus tidak valid.');
  return { tanggal: date(body.tanggal), dokter: text(body.dokter, 'Dokter', true), rumahSakit: text(body.rumahSakit, 'Rumah Sakit', true), team: text(body.team, 'Team Pelapor', true), tindakan: text(body.tindakan, 'Tindakan', true, 500), komplain: text(body.komplain, 'Masalah', true, 5000), jalanKeluar: text(body.jalanKeluar, 'Solusi', completed, 5000), penangananSelanjutnya: text(body.penangananSelanjutnya, 'Rencana tindak lanjut', false, 5000), statusCase: body.statusCase };
}
export function validatePhotos(photos) {
  if (photos == null) return [];
  if (!Array.isArray(photos) || photos.length > 5) throw new ApiError('Maksimal 5 foto per pengiriman.');
  let total = 0;
  return photos.map((photo) => {
    if (!photo || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType) || typeof photo.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64)) throw new ApiError('Data foto tidak valid.');
    const bytes = Buffer.from(photo.base64, 'base64');
    total += bytes.length;
    const valid = photo.mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : photo.mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!valid || bytes.length > 5000000 || total > 3000000) throw new ApiError('Foto tidak valid atau terlalu besar. Kurangi ukuran/jumlah foto.');
    return { bytes, mimeType: photo.mimeType, filename: text(photo.filename, 'Nama file', false) || 'foto.jpg' };
  });
}
export function mutateReport(action, body, old, user, accounts, photos, now) {
  if (!user?.active || user.approval && user.approval !== 'approved' || user.mustChangePassword) throw new ApiError('Akun tidak diizinkan mengakses laporan.', 403);
  let item;
  const note = text(body.catatan, 'Catatan', false, 2000);
  const detail = {};
  if (action === 'create') {
    if (!/^[a-f0-9-]{36}$/.test(body.requestId || '')) throw new ApiError('ID permintaan tidak valid.');
    if (old) {
      if (old.deletedAt || old.pelaporId !== user.id) throw new ApiError('ID permintaan sudah digunakan atau diarsipkan.', 409);
      return { item: old, duplicate: true };
    }
    item = { ...content(body), solusiAwal: text(body.jalanKeluar, 'Solusi awal', false, 5000), id: `ID-${body.requestId}`, status: '', statusPenanganan: 'Baru', picId: '', picNama: '', tenggat: '', pelaporId: user.id, pelaporNama: user.nama, pelaporRole: user.role, createdAt: now, updatedAt: now, selesaiPada: '', deletedAt: '', version: 1, fotoIds: [], photoRefs: photos, photoCount: photos.length };
    detail.statusPenanganan = 'Baru';
  } else {
    // No per-report read gate here on purpose — every active account can read every report
    // (team-wide transparency), so only existence/deleted/migration-pending are checked. Who may
    // *edit* is still restricted, via `mayEdit` just below.
    if (!old || old.deletedAt || old.migrationPending) throw new ApiError('Laporan tidak ditemukan atau tidak dapat diakses.', 404);
    if (Number(body.version) !== old.version) throw new ApiError('Laporan sudah diperbarui pengguna lain. Muat ulang data lalu ulangi perubahan.', 409);
    if ((old.photoCount || 0) + photos.length > 15) throw new ApiError('Total foto pada laporan maksimal 15.');
    item = { ...old };
    detail.before = snapshot(old);
    const mayEdit = user.role === 'admin' || old.pelaporId === user.id && old.statusPenanganan === 'Baru';
    if (action === 'update') {
      if (!mayEdit) throw new ApiError('Hanya admin atau pelapor saat status Baru dapat mengedit laporan.', 403);
      const edited = content({ ...old, ...body, jalanKeluar: body.jalanKeluar ?? old.solusiAwal ?? (old.statusPenanganan === 'Baru' ? old.jalanKeluar || '' : '') });
      edited.solusiAwal = edited.jalanKeluar;
      if (old.statusPenanganan !== 'Baru') edited.jalanKeluar = old.jalanKeluar || '';
      Object.assign(item, edited);
      item.photoRefs = [...(old.photoRefs || []), ...photos];
      detail.fields = contents.filter((key) => old[key] !== item[key]);
    } else if (action === 'delete') {
      if (!mayEdit) throw new ApiError('Tidak diizinkan mengarsipkan laporan.', 403);
      item.deletedAt = now;
    } else if (action === 'assign') {
      if (user.role !== 'admin' && !(user.role === 'petugas' && !old.picId && body.picId === user.id)) throw new ApiError('Hanya admin dapat mengubah penugasan.', 403);
      if (old.statusPenanganan === 'Selesai') throw new ApiError('Buka kembali laporan sebelum mengubah penugasan.', 409);
      const pic = body.picId ? accounts.find((account) => account.id === body.picId && account.active && (!account.approval || account.approval === 'approved') && (account.role === 'petugas' || account.role === 'pelapor' && account.id === old.pelaporId)) : null;
      if (body.picId && !pic) throw new ApiError('Pilih petugas aktif atau pelapor kasus ini sebagai PIC.');
      if (!pic && old.statusPenanganan !== 'Baru') throw new ApiError('Laporan yang sedang ditangani harus memiliki PIC.');
      Object.assign(item, { picId: pic?.id || '', picNama: pic?.nama || '', picRole: pic?.role || null, tenggat: date(body.tenggat, true) });
    } else if (action === 'followUp') {
      if (user.role !== 'admin' && old.picId !== user.id) throw new ApiError('Hanya admin atau PIC dapat mencatat tindak lanjut.', 403);
      if (old.statusPenanganan === 'Selesai') throw new ApiError('Buka kembali laporan sebelum melanjutkan.', 409);
      if (!old.picId || !['Diproses', 'Menunggu', 'Selesai'].includes(body.statusPenanganan)) throw new ApiError('PIC atau status penanganan tidak valid.');
      if (!levels.includes(body.status || old.status)) throw new ApiError('Pilih tingkat keparahan sebelum menyimpan tindak lanjut.');
      item.solusiAwal = old.solusiAwal ?? (old.statusPenanganan === 'Baru' ? old.jalanKeluar || '' : '');
      Object.assign(item, { statusPenanganan: body.statusPenanganan, jalanKeluar: text(body.jalanKeluar, 'Solusi', body.statusPenanganan === 'Selesai', 5000), penangananSelanjutnya: text(body.penangananSelanjutnya ?? old.penangananSelanjutnya, 'Rencana tindak lanjut', false, 5000), selesaiPada: body.statusPenanganan === 'Selesai' ? now : '' });
      detail.photoRefs = photos;
    } else if (action === 'reopen') {
      if (user.role !== 'admin' && old.pelaporId !== user.id) throw new ApiError('Hanya admin atau pelapor dapat membuka kembali laporan.', 403);
      if (old.statusPenanganan !== 'Selesai' || !note) throw new ApiError('Laporan harus selesai dan alasan wajib diisi.');
      Object.assign(item, { statusPenanganan: 'Baru', selesaiPada: '' });
    } else throw new ApiError('Aksi laporan tidak valid.');
    if (body.status !== undefined && body.status !== '') {
      if (!['assign', 'followUp'].includes(action) && !(action === 'update' && user.role === 'admin')) throw new ApiError('Tidak diizinkan mengubah keparahan.', 403);
      if (!levels.includes(body.status)) throw new ApiError('Tingkat keparahan tidak valid.');
      item.status = body.status;
    }
    item.photoCount = (old.photoCount || 0) + photos.length;
    item.version += 1; item.updatedAt = now;
    detail.after = snapshot(item);
  }
  if (photos.length > 5 || photos.length && !['create', 'update', 'followUp'].includes(action)) throw new ApiError('Foto hanya dapat ditambahkan pada laporan atau tindak lanjut.');
  const history = { id: backupId(item.id, item.version), reportId: item.id, tanggal: now, userId: user.id, nama: user.nama, aksi: { create: 'Laporan dibuat', update: 'Laporan diedit', delete: 'Laporan diarsipkan', assign: 'Penanggung jawab diperbarui', followUp: 'Tindak lanjut', reopen: 'Laporan dibuka kembali' }[action], catatan: note, detail: JSON.stringify(detail) };
  // @mention notifications only cover catatan/RTL/description text, and only newly-added
  // mentions — re-saving text that already mentioned someone should not keep re-notifying them.
  const mentionableText = (source) => `${source.komplain || ''}\n${source.jalanKeluar || ''}\n${source.penangananSelanjutnya || ''}`;
  let mentions = [];
  if (action === 'assign' || action === 'reopen') mentions = newMentions('', note, accounts, user.id);
  else if (action === 'followUp') mentions = newMentions(`${old.jalanKeluar || ''}\n${old.penangananSelanjutnya || ''}`, `${item.jalanKeluar || ''}\n${item.penangananSelanjutnya || ''}\n${note}`, accounts, user.id);
  else if (action === 'create') mentions = newMentions('', mentionableText(item), accounts, user.id);
  else if (action === 'update') mentions = newMentions(mentionableText(old), mentionableText(item), accounts, user.id);
  return { item, history, mentions, mentionSnippet: note || item.penangananSelanjutnya || item.jalanKeluar || '' };
}
export function publicReport(item, accounts = [], user = null) {
  const { photoRefs = [], fotoIds = [], reactions = {}, ...result } = item;
  delete result.photoCount; delete result.migrationSourceHash; delete result.migrationPending;
  result.pelaporRole = accounts.find((account) => account.id === item.pelaporId)?.role || item.pelaporRole || null;
  result.picRole = accounts.find((account) => account.id === item.picId)?.role || item.picRole || null;
  result.fotoUrls = [...fotoIds.map((id) => `/api/photo?report=${encodeURIComponent(item.id)}&id=${encodeURIComponent(id)}`), ...photoRefs.map((photo) => `/api/photo?report=${encodeURIComponent(item.id)}&path=${encodeURIComponent(photo.path)}`)];
  // Per-user reaction map never leaves the server — only aggregate counts plus the requesting
  // user's own reaction (so the like/love buttons know which one to highlight).
  const values = Object.values(reactions);
  result.reactions = { like: values.filter((value) => value === 'like').length, love: values.filter((value) => value === 'love').length, mine: (user && reactions[user.id]) || null };
  return result;
}
// Who reacted and with what — resolved to names, for the detail view's "lihat siapa" list.
// Deliberately left out of publicReport/the list action (which only ever needs the aggregate
// counts) so the bulk report list doesn't carry every reactor's identity on every poll.
export function reactionDetails(item, accounts = []) {
  return Object.entries(item.reactions || {}).map(([userId, type]) => ({ userId, type, nama: accounts.find((account) => account.id === userId)?.nama || 'Pengguna' }));
}
