import test from 'node:test';
import assert from 'node:assert/strict';
import { isSameOrigin } from '../src/lib/server/request-origin.mjs';
const request = (headers = {}) => new Request('http://localhost:3105/api/komplain', { headers });
test('local IP and LAN hosts work when Next.js uses an internal hostname', () => {
  assert.equal(isSameOrigin(request({ host: '127.0.0.1:3105', origin: 'http://127.0.0.1:3105' })), true);
  assert.equal(isSameOrigin(request({ host: '192.168.1.42:3105', origin: 'http://192.168.1.42:3105' })), true);
  assert.equal(isSameOrigin(request({ origin: 'http://localhost:3105' })), true);
});
test('missing origin, different hosts/ports, and cross-site requests remain blocked', () => {
  assert.equal(isSameOrigin(request()), false);
  assert.equal(isSameOrigin(request({ host: 'localhost:3105', origin: 'http://localhost:3106' })), false);
  assert.equal(isSameOrigin(request({ host: 'localhost:3105', origin: 'https://foreign.example' })), false);
  assert.equal(isSameOrigin(request({ host: 'localhost:3105', origin: 'http://localhost:3105', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(isSameOrigin(request({ host: 'bad host', origin: 'http://localhost:3105' })), false);
  assert.equal(isSameOrigin(request({ origin: 'null' })), false);
});
