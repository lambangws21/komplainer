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

test('existing Firebase accounts get reporter profiles and only the configured account gets admin', () => {
  const f = createFixture();
  const uid = 'existing-firebase-uid';
  const body = { action: 'firebaseLink', firebaseUid: uid, email: 'existing@example.test', nama: 'Existing Firebase', grantAdmin: false };
  const first = f.request(body).user;
  assert.equal(first.role, 'pelapor');
  assert.equal(first.firebaseUid, uid);
  assert.equal(first.mustChangePassword, false);
  assert.equal(f.request(body).user.id, first.id);
  assert.equal(f.request({ action: 'session', firebaseSessionUid: uid }).user.id, first.id);
  assert.equal(f.request({ action: 'users', firebaseSessionUid: uid }).code, 403);
  assert.equal(f.request({ ...body, grantAdmin: true }).user.role, 'admin');
  assert.equal(f.request({ action: 'users', firebaseSessionUid: uid }).status, 'success');
  assert.equal(f.request({ action: 'session', firebaseSessionUid: 'unlinked-uid' }).code, 401);
  assert.equal(f.request({ ...body, apiKey: 'wrong' }).code, 403);
});

test('linking a legacy profile requires verified email and keeps report ownership', () => {
  const f = createFixture();
  const reporter = f.addUser('link-existing@example.test');
  const item = f.createReport(reporter).data;
  const body = { action: 'firebaseLink', email: reporter.user.email, firebaseUid: 'firebase-existing-user', nama: 'Firebase Existing', emailVerified: false };
  assert.equal(f.request(body).code, 403);
  const linked = f.request({ ...body, emailVerified: true }).user;
  assert.equal(linked.id, reporter.user.id);
  assert.equal(f.request({ action: 'list', firebaseSessionUid: body.firebaseUid }).data[0].id, item.id);
  assert.equal(f.request({ action: 'session', ...reporter }).code, 401);
  assert.equal(f.request({ ...body, firebaseUid: 'different-firebase-user', emailVerified: true }).code, 409);
  const row = f.ss.getSheetByName('Pengguna').data.find((row) => row[0] === linked.id);
  row[6] = false;
  assert.equal(f.request(body).code, 403);
});

test('resetting an existing Firebase UID retains its original identity and temporary-password gate', () => {
  const f = createFixture();
  const linked = f.request({ action: 'firebaseLink', firebaseUid: 'firebase-old-uid', email: 'reset-existing@example.test', nama: 'Firebase Old' }).user;
  assert.equal(f.request({ action: 'resetPassword', ...f.adminSession, id: linked.id, passwordHash: 'firebase:firebase-old-uid' }).status, 'success');
  assert.equal(f.request({ action: 'list', firebaseSessionUid: 'firebase-old-uid' }).code, 403);
  assert.equal(f.request({ action: 'firebasePasswordChanged', firebaseSessionUid: 'firebase-old-uid' }).status, 'success');
  assert.equal(f.request({ action: 'list', firebaseSessionUid: 'firebase-old-uid' }).status, 'success');
});
