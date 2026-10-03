import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, createToken, tokenHash } from '../src/lib/server/password.mjs';
test('salted hashes verify without storing plaintext; wrong and corrupt hashes fail', async () => {
  const password = 'Demo-password-only-2026';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('Wrong-password', first), false);
  assert.equal(await verifyPassword(password, 'corrupt'), false);
  await assert.rejects(hashPassword('short'));
});
test('session tokens are random and represented by digests in Sheets', () => {
  const first = createToken();
  const second = createToken();
  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.match(tokenHash(first), /^[a-f0-9]{64}$/);
  assert.notEqual(tokenHash(first), first);
});
