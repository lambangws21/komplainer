export async function apiRequest(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin', ...options });
  let result;
  try { result = await response.json(); } catch { throw new Error('Respons server tidak valid. Coba lagi.'); }
  if (!response.ok || result.status !== 'success') {
    const error = new Error(result.message || 'Permintaan gagal.');
    error.code = response.status;
    throw error;
  }
  return result;
}
export const postJson = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
