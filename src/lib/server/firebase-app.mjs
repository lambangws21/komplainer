import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { ApiError } from './api-error.mjs';

export function firebaseApp() {
  const existing = getApps().find((app) => app.name === 'komplainer');
  if (existing) return existing;
  try {
    const account = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      : JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    return initializeApp({ credential: cert(account), projectId: account.project_id, ...(process.env.FIREBASE_STORAGE_BUCKET ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET } : {}) }, 'komplainer');
  } catch { throw new ApiError('Konfigurasi Firebase Admin belum valid. Periksa kredensial server.', 503); }
}
