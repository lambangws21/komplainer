// Shared between server (mention detection/notifications) and client (autocomplete, highlighting).
// Mentions are plain "@Full Name" text — no special markup — matched against the live account
// directory so they round-trip through the existing plain-text report/history storage untouched.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function mentionPattern(name) {
  return new RegExp(`@${escapeRegExp(name)}(?=$|[\\s.,!?;:()])`, 'g');
}
export function extractMentions(text, accounts) {
  const value = String(text || '');
  if (!value.includes('@')) return [];
  const found = new Set();
  const consumed = new Array(value.length).fill(false);
  // Longest name first, so "@Budi Santoso" is credited to that account rather than also
  // matching a shorter "Budi" account whose name happens to be a prefix of it.
  for (const account of [...accounts].filter((item) => item.nama).sort((a, b) => b.nama.length - a.nama.length)) {
    const pattern = mentionPattern(account.nama);
    let match;
    while ((match = pattern.exec(value))) {
      const start = match.index; const end = start + match[0].length;
      if (!consumed.slice(start, end).some(Boolean)) {
        found.add(account.id);
        for (let i = start; i < end; i++) consumed[i] = true;
      }
    }
  }
  return [...found];
}
// Only mentions newly present in `next` (not already in `previous`) are reported, so re-saving
// text that already mentioned someone doesn't keep re-notifying them.
export function newMentions(previous, next, accounts, excludeId) {
  const before = new Set(extractMentions(previous, accounts));
  return extractMentions(next, accounts).filter((id) => id !== excludeId && !before.has(id));
}

// Match the unfinished mention at the caret, including names containing spaces.
export function mentionSuggestions(textBefore, accounts = []) {
  const match = /(?:^|[\s(])@([^@\n]{0,60})$/.exec(textBefore);
  if (!match || accounts.some((account) => account.nama && textBefore.endsWith(`@${account.nama} `))) return null;
  const query = match[1].trim().toLocaleLowerCase('id-ID');
  const options = accounts.filter((account) => account.nama?.toLocaleLowerCase('id-ID').includes(query))
    .sort((a, b) => Number(b.nama.toLocaleLowerCase('id-ID').startsWith(query)) - Number(a.nama.toLocaleLowerCase('id-ID').startsWith(query)) || a.nama.localeCompare(b.nama, 'id')).slice(0, 8);
  return { options, length: match[1].length + 1 };
}
