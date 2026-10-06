const key = (userId) => `komplain-read-${userId}`;

export function loadReadIds(userId) {
  if (typeof window === 'undefined' || !userId) return new Set();
  try { return new Set(JSON.parse(window.localStorage.getItem(key(userId)) || '[]')); }
  catch { return new Set(); }
}

export function saveReadIds(userId, ids) {
  if (typeof window === 'undefined' || !userId) return;
  try { window.localStorage.setItem(key(userId), JSON.stringify([...ids])); }
  catch { /* storage unavailable (private mode, quota, etc.) */ }
}
