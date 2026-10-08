export const MAX_PHOTOS = 5;
// Keep in sync with MAX_PHOTOS_TOTAL in docs/appscript.gs — the report-wide cap across create
// plus every follow-up, not just this one submission.
export const MAX_PHOTOS_TOTAL = 15;
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

export function readableSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadDrawable(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal membaca gambar.'));
    img.src = URL.createObjectURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Gagal membaca data foto.'));
    reader.readAsDataURL(blob);
  });
}

function renameToJpeg(name) {
  return `${String(name || 'foto').replace(/\.[a-z0-9]+$/i, '')}.jpg`;
}

// Resizes to a max dimension and re-encodes as JPEG so uploads stay small over mobile networks.
export async function compressImage(file) {
  if (!file.type || !file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
  const source = await loadDrawable(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth; canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Gagal memproses foto.'))), 'image/jpeg', JPEG_QUALITY));
  const base64 = await blobToBase64(blob);
  return { base64, mimeType: 'image/jpeg', filename: renameToJpeg(file.name), size: blob.size, previewUrl: URL.createObjectURL(blob) };
}
