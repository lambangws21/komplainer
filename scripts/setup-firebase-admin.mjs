import nextEnv from '@next/env';
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { appClaims, profileFromAccount } from '../src/lib/server/firebase-profile.mjs';

nextEnv.loadEnvConfig(process.cwd());
let app;
try {
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  if (!process.env.FIREBASE_ADMIN_UID) throw new Error('FIREBASE_ADMIN_UID belum diisi.');
  app = initializeApp({ credential: cert(credential), projectId: credential.project_id });
  const auth = getAuth(app);
  const account = await auth.getUser(process.env.FIREBASE_ADMIN_UID);
  if (account.disabled) throw new Error('Akun Admin Firebase dinonaktifkan.');
  const current = account.customClaims?.komplainer;
  const claims = appClaims(account, { role: 'admin', unit: current?.unit || 'Pusat', active: true, mustChangePassword: current?.mustChangePassword === true });
  await auth.setCustomUserClaims(account.uid, claims);
  const profile = profileFromAccount(await auth.getUser(account.uid));
  console.log(`Admin Komplainer siap: ${profile.email}. Password Firebase tidak diubah.`);
} catch (error) {
  console.error(error.code ? `Setup Firebase gagal (${error.code}).` : error.message);
  process.exitCode = 1;
} finally { if (app) await app.delete(); }
