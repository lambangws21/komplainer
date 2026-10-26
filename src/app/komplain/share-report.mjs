import { handlingStatus } from './workflow.mjs';

// Deep link back into this specific report; page.jsx reads ?report=<id> on load and opens it
// the same way a notification click does (setTab('table') + setPendingDetailId).
export function shareUrl(item) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/komplain?report=${encodeURIComponent(item.id)}`;
}

export function shareText(item, formatDate) {
  const status = handlingStatus(item);
  const lines = [
    `Laporan Komplain — ${item.dokter || 'Dokter belum diisi'} · ${item.rumahSakit || 'RS belum diisi'}`,
    `Status: ${status}${item.tindakan ? ` · ${item.tindakan}` : ''}`,
  ];
  if (formatDate && item.tanggal) lines.push(`Tanggal: ${formatDate(item.tanggal)}`);
  if (status === 'Selesai' && item.jalanKeluar) lines.push(`Penyelesaian: ${item.jalanKeluar.slice(0, 200)}`);
  lines.push(shareUrl(item));
  return lines.join('\n');
}

export const whatsappShareUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const telegramShareUrl = (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

// Inviting a colleague to the app itself (not a specific report) — points at /komplain so the
// link works whether or not they're logged in yet, and nudges them to install it once there.
export function appShareUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/komplain`;
}
export function appShareText() {
  return ['Komplainer — aplikasi pencatatan & tindak lanjut komplain lapangan.', 'Buka linknya, lalu pasang ke layar utama HP/laptop supaya lebih cepat dan dapat notifikasi:', appShareUrl()].join('\n');
}
