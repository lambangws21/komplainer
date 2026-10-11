import 'server-only';
import { ApiError } from './api-error.mjs';

const WINDOW_MS = 5 * 60 * 1000;
const MAX_BUCKETS = 5000;
// Per-instance in-memory store: there's no shared KV/Redis in this project, and for this app's
// traffic an occasional reset on cold start/scale-out is an acceptable trade-off vs. the added
// latency of a persisted counter on every login attempt.
const buckets = new Map();

function prune(timestamps, now) {
  const cutoff = now - WINDOW_MS;
  let start = 0;
  while (start < timestamps.length && timestamps[start] < cutoff) start++;
  return start > 0 ? timestamps.slice(start) : timestamps;
}

export function checkRateLimit(key, limit) {
  const now = Date.now();
  const timestamps = prune(buckets.get(key) || [], now);
  if (timestamps.length >= limit) { buckets.set(key, timestamps); throw new ApiError('Terlalu banyak percobaan. Coba lagi dalam beberapa menit.', 429); }
  timestamps.push(now);
  buckets.set(key, timestamps);
  if (buckets.size > MAX_BUCKETS) for (const [bucketKey, bucketTimestamps] of buckets) if (!prune(bucketTimestamps, now).length) buckets.delete(bucketKey);
}

export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
