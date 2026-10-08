import test from 'node:test';
import assert from 'node:assert/strict';
import { compressImage } from '../src/app/komplain/image-utils.mjs';

test('mobile photo compression limits dimensions, creates JPEG, and releases decoded image memory', async () => {
  const original = { document: globalThis.document, createImageBitmap: globalThis.createImageBitmap, FileReader: globalThis.FileReader };
  let closed = false;
  let drawn;
  const canvas = {
    getContext: () => ({ drawImage: (...args) => { drawn = args; } }),
    toBlob: (callback, mimeType, quality) => { assert.equal(mimeType, 'image/jpeg'); assert.ok(quality < 1); callback(new Blob(['test-image'], { type: mimeType })); },
  };
  globalThis.document = { createElement: () => canvas };
  globalThis.createImageBitmap = async () => ({ width: 4000, height: 3000, close: () => { closed = true; } });
  globalThis.FileReader = class { readAsDataURL() { this.result = 'data:image/jpeg;base64,dGVzdC1pbWFnZQ=='; this.onloadend(); } };
  let image;
  try {
    image = await compressImage({ type: 'image/png', name: 'foto.png' });
    assert.equal(canvas.width, 1280); assert.equal(canvas.height, 960);
    assert.equal(drawn[3], 1280); assert.equal(drawn[4], 960);
    assert.equal(closed, true);
    assert.equal(image.mimeType, 'image/jpeg'); assert.equal(image.filename, 'foto.jpg');
    assert.equal(image.base64, 'dGVzdC1pbWFnZQ=='); assert.ok(image.previewUrl.startsWith('blob:'));
  } finally { if (image) URL.revokeObjectURL(image.previewUrl); Object.assign(globalThis, original); }
});

test('invalid files are rejected and missing canvas still releases decoded image', async () => {
  await assert.rejects(() => compressImage({ type: 'text/plain' }), /gambar/);
  const original = { document: globalThis.document, createImageBitmap: globalThis.createImageBitmap };
  let closed = false;
  globalThis.document = { createElement: () => ({ getContext: () => null }) };
  globalThis.createImageBitmap = async () => ({ width: 400, height: 300, close: () => { closed = true; } });
  try { await assert.rejects(() => compressImage({ type: 'image/png' }), /memproses foto/); assert.equal(closed, true); }
  finally { Object.assign(globalThis, original); }
});
