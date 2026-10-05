import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { firebaseEmail, firebaseUid, complaintUserId } from '../src/lib/server/firebase-identity.mjs';
import { authenticateFirebase } from '../src/lib/server/firebase-login.mjs';
import { createFixture, fakeHash } from './helpers/apps-script-fixture.mjs';

test('Firebase identity is scoped to Komplainer and preserves legacy admin username', () => {
  const id = `USR-${randomUUID()}`;
  assert.equal(complaintUserId(firebaseUid(id)), id);
  assert.throws(() => complaintUserId(id));
  assert.throws(() => complaintUserId('another-app:admin'));
  assert.equal(firebaseEmail('lambangws'), 'lambangws@komplainer.invalid');
});

test('migration only follows successful password and matching Firebase UID', async () => {
  const user = { id: `USR-${randomUUID()}` };
  const events = [];
  const services = {
    getAccount: async () => null,
    verifyLegacy: async () => false,
    createAccount: async () => events.push('created'),
    signIn: async () => ({ localId: firebaseUid(user.id), idToken: 'test-token' }),
    migrate: async () => { events.push('migrated'); return { user }; },
  };
  await assert.rejects(authenticateFirebase({ user, passwordHash: fakeHash }, services), { code: 401 });
  assert.deepEqual(events, []);
  services.verifyLegacy = async () => true;
  services.signIn = async () => ({ localId: 'another-app' });
  await assert.rejects(authenticateFirebase({ user, passwordHash: fakeHash }, services), { code: 403 });
  assert.deepEqual(events, ['created']);
  events.length = 0;
  services.getAccount = async () => ({ uid: firebaseUid(user.id) });
  services.verifyLegacy = async () => { throw new Error('Legacy fallback forbidden'); };
  services.signIn = async () => { throw Object.assign(new Error('Wrong Firebase password'), { code: 401 }); };
  await assert.rejects(authenticateFirebase({ user, passwordHash: fakeHash }, services), { code: 401 });
  assert.deepEqual(events, []);
  services.signIn = async () => ({ localId: firebaseUid(user.id), idToken: 'test-token' });
  const result = await authenticateFirebase({ user, passwordHash: fakeHash }, services);
  assert.equal(result.user.id, user.id);
  assert.deepEqual(events, ['migrated']);
});

test('Firebase migration erases the Sheet hash, revokes old sessions and preserves case scope', () => {
  const f = createFixture();
  const reporter = f.addUser('firebase-reporter@example.test');
  const item = f.createReport(reporter).data;
  assert.equal(f.request({ action: 'firebaseMigrate', id: reporter.user.id, firebaseUid: 'wrong', expectedHash: fakeHash }).code, 403);
  assert.equal(f.request({ action: 'firebaseMigrate', id: reporter.user.id, firebaseUid: firebaseUid(reporter.user.id), expectedHash: 'wrong' }).code, 409);
  const migrated = f.request({ action: 'firebaseMigrate', id: reporter.user.id, firebaseUid: firebaseUid(reporter.user.id), expectedHash: fakeHash });
  assert.equal(migrated.user.id, reporter.user.id);
  assert.equal(f.request({ action: 'session', ...reporter }).code, 401);
  const row = f.ss.getSheetByName('Pengguna').data.find((row) => row[0] === reporter.user.id);
  assert.equal(row[5], `firebase:${firebaseUid(reporter.user.id)}`);
  const session = { firebaseUserId: reporter.user.id };
  assert.equal(f.request({ action: 'list', ...session }).data[0].id, item.id);
  assert.equal(f.request({ action: 'users', ...session }).code, 403);
  assert.equal(f.request({ action: 'list', ...session, apiKey: 'wrong' }).code, 403);
  row[6] = false;
  assert.equal(f.request({ action: 'list', ...session }).code, 401);
});

test('Firebase temporary passwords remain gated and admin can reset to Firebase identities', () => {
  const f = createFixture();
  const id = `USR-${randomUUID()}`;
  const created = f.request({ action: 'createUser', ...f.adminSession, firebaseAccountId: id, nama: 'Firebase User', email: 'new-firebase@example.test', role: 'pelapor', unit: 'Team A', passwordHash: `firebase:${firebaseUid(id)}` });
  assert.equal(created.user.id, id);
  const session = { firebaseUserId: id };
  assert.equal(f.request({ action: 'list', ...session }).code, 403);
  assert.equal(f.request({ action: 'firebasePasswordChanged', ...session }).status, 'success');
  assert.equal(f.request({ action: 'list', ...session }).status, 'success');
  assert.equal(f.request({ action: 'resetPassword', ...f.adminSession, id, passwordHash: `firebase:${firebaseUid(f.admin.id)}` }).code, 400);
  assert.equal(f.request({ action: 'resetPassword', ...f.adminSession, id, passwordHash: `firebase:${firebaseUid(id)}` }).status, 'success');
  assert.equal(f.request({ action: 'list', ...session }).code, 403);
});
