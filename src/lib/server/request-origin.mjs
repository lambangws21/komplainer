// Next.js can use its internal listening hostname in request.url. Browser Origin
// must match the request's actual Host, including its port, instead.
export function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try {
    const url = new URL(request.url);
    const host = request.headers.get('host');
    const expected = host ? new URL(`${url.protocol}//${host}`).origin : url.origin;
    return origin === expected;
  } catch { return false; }
}
