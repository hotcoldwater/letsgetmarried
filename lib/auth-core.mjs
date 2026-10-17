import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
import { ACCOUNTS } from './account-names.mjs';
export { ACCOUNTS };
export function accountRole(username) {
  if (typeof username !== 'string') return null;
  return Object.keys(ACCOUNTS).find(role => ACCOUNTS[role] === username.trim().toLowerCase()) || null;
}
export const digest = value => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export function passwordValid(password) { return typeof password === 'string' && [...password].length >= 15 && password.length <= 256; }
export async function hashPassword(password) {
  if (!passwordValid(password)) throw new Error('PASSWORD_LENGTH');
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const valid = typeof encoded === 'string' && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  const [, salt, expected] = valid ? encoded.split('$') : ['scrypt', '0'.repeat(32), '0'.repeat(128)];
  const actual = await derive(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && valid;
}
