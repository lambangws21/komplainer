import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileId, profileFromAccount, appClaims, assertAccountChange } from '../src/lib/server/firebase-profile.mjs';
import { createFixture } from './helpers/apps-script-fixture.mjs';

test('Firebase profiles use stable IDs and only application-scoped roles', () => {
  const account = { uid: 'existing-account', email: 'existing@example.test', displayName: 'Existing' };
  assert.equal(profileId(account.uid), profileId(account.uid));
  assert.equal(profileFromAccount({ ...account, customClaims: { admin: true } }), null);
  const claims = appClaims({ ...account, customClaims: { otherApp: 'preserved' } }, { role: 'pelapor', unit: 'Team A', active: true, mustChangePassword: true });
  assert.equal(claims.otherApp, 'preserved');
  const profile = profileFromAccount({ ...account, customClaims: claims });
  assert.equal(profile.role, 'pelapor');
  assert.equal(profile.mustChangePassword, true);
  assert.equal(profileFromAccount({ ...account, disabled: true, customClaims: claims }).active, false);
  assert.throws(() => appClaims(account, { role: 'pelapor', unit: 'x'.repeat(1100) }));
});

test('configured admin and last active admin cannot lose access', () => {
  const target = { id: 'USR-a', firebaseUid: 'selected-admin', role: 'admin', active: true };
  assert.throws(() => assertAccountChange(target, { role: 'pelapor', active: true }, [target], 'selected-admin'), { code: 409 });
  assert.throws(() => assertAccountChange(target, { role: 'admin', active: false }, [target], 'other'), { code: 409 });
});

test('data-only Apps Script uses verified server context and does not create account/session sheets', () => {
  const f = createFixture();
  const sheets = f.ss.getSheets();
  for (const name of ['Pengguna', 'Sesi']) sheets.splice(sheets.findIndex((sheet) => sheet.name === name), 1);
  f.context.DATA_ONLY = true;
  const user = { id: profileId('firebase-user'), nama: 'Firebase Reporter', email: 'reporter@example.test', role: 'pelapor', unit: 'Team A', active: true, mustChangePassword: false };
  const firebaseContext = { user, accounts: [user] };
  assert.equal(f.request({ action: 'list' }).code, 401);
  assert.equal(f.request({ action: 'login' }).code, 403);
  const created = f.createReport({ firebaseContext }).data;
  assert.equal(created.pelaporId, user.id);
  assert.equal(created.pelaporRole, 'pelapor');
  assert.equal(f.request({ action: 'list', firebaseContext }).data.length, 1);
  assert.equal(f.request({ action: 'list', firebaseContext, apiKey: 'wrong' }).code, 403);
  assert.equal(f.request({ action: 'users', firebaseContext }).code, 403);
  const other = { ...user, id: profileId('other') };
  assert.equal(f.request({ action: 'list', firebaseContext: { user: other, accounts: [user, other] } }).data.length, 0);
  assert.equal(f.ss.getSheetByName('Pengguna'), undefined);
  assert.equal(f.ss.getSheetByName('Sesi'), undefined);
  assert.equal(f.context.FIREBASE_DIRECTORY, null);
});
