export const IMPLANTS = [
  { key: 'zimmer-biomet', label: 'Zimmer Biomet', match: /zimmer\s*\/?\s*biomet/i, color: 'text-cyan-300 border-cyan-800 bg-cyan-950/40' },
  { key: 'zimmer', label: 'Zimmer', match: /zimmer(?!\s*\/?\s*biomet)/i, color: 'text-blue-300 border-blue-800 bg-blue-950/40' },
  { key: 'normmed', label: 'Normmed/Normed', match: /normm?ed/i, color: 'text-amber-300 border-amber-800 bg-amber-950/40' },
  { key: 'rosa', label: 'ROSA', match: /\brosa\b/i, color: 'text-pink-300 border-pink-800 bg-pink-950/40' },
];
export function detectImplants(item) {
  const text = `${item?.tindakan || ''} ${item?.komplain || ''}`;
  return IMPLANTS.filter((implant) => implant.match.test(text));
}
