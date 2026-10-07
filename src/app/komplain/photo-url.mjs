// Drive serves uc?export=view with Cross-Origin-Resource-Policy: same-site, which browsers
// block as an <img> src from another origin. Route Drive URLs through our own proxy; leave
// everything else (local base64 previews during upload, etc.) untouched.
export function displaySrc(url) {
  const match = typeof url === 'string' && url.match(/^https:\/\/drive\.google\.com\/uc\?export=view&id=([a-zA-Z0-9_-]+)$/);
  return match ? `/api/photo?id=${match[1]}` : url;
}
