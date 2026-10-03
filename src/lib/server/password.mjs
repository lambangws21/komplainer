import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export const SESSION_SECONDS = 8 * 60 * 60;
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Password harus terdiri dari 12–128 karakter.');
}
export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const parts = String(stored || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const actual = await scrypt(password, parts[1], 64);
  return timingSafeEqual(actual, Buffer.from(parts[2], 'hex'));
}
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export const createToken = () => randomBytes(32).toString('hex');
