import { json, errorResponse, callScript, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';

export const maxDuration = 15;
// Proxies to Photon (photon.komoot.io), a free/open-source geocoder built on OpenStreetMap data —
// no API key or billing account needed. Kept behind our own route (rather than called directly
// from the browser) so: (1) we can send the descriptive User-Agent its usage policy expects
// (browsers don't let JS set that header), (2) swapping providers later (e.g. to Google Places)
// only means editing this one file, nothing on the client changes, (3) it stays session-gated so
// this app doesn't become an open, anonymous relay for random traffic hitting a free public API.
const ENDPOINT = 'https://photon.komoot.io/api/';
// Soft bias toward Indonesia (Jakarta) — Photon nudges ranking toward this point without
// excluding results elsewhere, so a query like "RS Harapan Bunda" still resolves sensibly.
const BIAS = { lat: -6.2, lon: 106.8, zoom: 8 };

export async function GET(request) {
  try {
    const user = usesFirebase() ? await currentFirebaseUser() : (await callScript('session')).user;
    // Jadwal & Agenda is admin-only while in development — open to petugas/pelapor once stable.
    if (user.role !== 'admin') throw new ApiError('Fitur jadwal masih tahap pengembangan, baru tersedia untuk admin.', 403);
    const q = (new URL(request.url).searchParams.get('q') || '').trim();
    if (q.length > 200) throw new ApiError('Pencarian lokasi terlalu panjang.');
    if (q.length < 3) return json({ status: 'success', data: [] });
    const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&limit=5&lang=id&lat=${BIAS.lat}&lon=${BIAS.lon}&zoom=${BIAS.zoom}`;
    let response;
    try { response = await fetch(url, { headers: { 'User-Agent': 'Komplainer/1.0 (internal hospital complaint tracker)' }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); }
    catch { throw new ApiError('Layanan pencarian lokasi belum dapat dihubungi. Coba lagi atau ketik lokasi manual.', 502); }
    if (!response.ok) throw new ApiError('Layanan pencarian lokasi belum dapat dihubungi. Coba lagi atau ketik lokasi manual.', 502);
    const geo = await response.json();
    const seen = new Set();
    const data = [];
    for (const feature of geo.features || []) {
      const p = feature.properties || {};
      const label = [p.name, p.street, p.city || p.county, p.state, p.country].filter(Boolean).filter((part, index, all) => all.indexOf(part) === index).join(', ');
      const [lng, lat] = feature.geometry?.coordinates || [];
      if (!label || typeof lat !== 'number' || typeof lng !== 'number' || seen.has(label)) continue;
      seen.add(label);
      data.push({ label, lat, lng });
    }
    return json({ status: 'success', data });
  } catch (error) { return errorResponse(error); }
}
