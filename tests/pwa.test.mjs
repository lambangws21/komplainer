import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
function setup(fetch) {
  const handlers = {};
  const added = [], deleted = [];
  const caches = {
    open: async () => ({ addAll: async (assets) => added.push(...assets) }),
    match: async (key) => key === '/offline.html' ? new Response('offline') : undefined,
    keys: async () => ['komplain-public-v0', 'komplain-public-v1', 'other-app-cache'],
    delete: async (key) => { deleted.push(key); return true; },
  };
  runInNewContext(source, { self: { location: { origin: 'https://example.com' }, addEventListener: (type, handler) => { handlers[type] = handler; } }, caches, fetch, URL, Response });
  const request = (path, mode = 'navigate', method = 'GET') => {
    let response;
    handlers.fetch({ request: { url: `https://example.com${path}`, method, mode }, respondWith: (value) => { response = value; } });
    return response;
  };
  return { handlers, request, added, deleted };
}
test('worker leaves API data, mutations, and unrelated pages untouched', () => {
  const worker = setup(() => { throw new Error('Unexpected fetch'); });
  assert.equal(worker.request('/api/komplain', 'cors'), undefined);
  assert.equal(worker.request('/api/komplain', 'cors', 'POST'), undefined);
  assert.equal(worker.request('/dashboard'), undefined);
  assert.equal(worker.request('/komplain', 'navigate', 'POST'), undefined);
});
test('navigation uses live network; network failure returns offline page', async () => {
  const online = setup(async () => new Response('live'));
  assert.equal(await (await online.request('/komplain')).text(), 'live');
  const offline = setup(async () => { throw new Error('Disconnected'); });
  assert.equal(await (await offline.request('/komplain')).text(), 'offline');
  assert.equal(await (await offline.request('/')).text(), 'offline');
});
test('installation caches public assets only; activation cleans own old caches', async () => {
  const worker = setup(async () => new Response('live'));
  let task;
  worker.handlers.install({ waitUntil: (value) => { task = value; } });
  await task;
  assert.deepEqual(worker.added, ['/offline.html', '/icons/komplain-192.png', '/icons/komplain-512.png', '/icons/komplain-180.png']);
  worker.handlers.activate({ waitUntil: (value) => { task = value; } });
  await task;
  assert.deepEqual(worker.deleted, ['komplain-public-v0']);
});
