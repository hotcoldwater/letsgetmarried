import 'server-only';
import { cookies } from 'next/headers';
import { configuration } from './config';
import { database } from './db';
import { DomainError, PEOPLE } from '../domain.mjs';
import { ACCOUNTS, digest, tokenValid } from '../auth-core.mjs';
export function cookieName() { return configuration().origin.startsWith('https:') ? '__Host-wedding_session' : 'wedding_session'; }
export async function sessionToken() { return (await cookies()).get(cookieName())?.value; }
export async function sessionCookie(value, maxAge = 30 * 86400) {
  (await cookies()).set(cookieName(), value, { httpOnly: true, secure: configuration().origin.startsWith('https:'), sameSite: 'lax', path: '/', maxAge });
}
export async function member() {
  const token = await sessionToken();
  if (!tokenValid(token)) throw new DomainError('아이디와 비밀번호로 로그인해 주세요.', 401);
  const [row] = await database()`SELECT a.role, a.username FROM wedding.sessions s JOIN wedding.accounts a ON a.role = s.role
    WHERE s.token_hash = ${digest(token)} AND s.expires_at > now() AND a.password_hash IS NOT NULL`;
  if (!row || ACCOUNTS[row.role] !== row.username) throw new DomainError('다시 로그인해 주세요.', 401);
  return { id: row.role, role: row.role, username: row.username, name: PEOPLE[row.role] };
}
export async function limitAttempts(role) {
  const sql = database(), window = Math.floor(Date.now() / 900000);
  const results = await sql.transaction(['global', role || 'unknown'].map(scope => sql`
    INSERT INTO wedding.auth_attempts(key, attempts, expires_at) VALUES (${'login:' + scope + ':' + window}, 1, now() + interval '30 minutes')
    ON CONFLICT(key) DO UPDATE SET attempts = wedding.auth_attempts.attempts + 1 RETURNING attempts`));
  if (results[0][0].attempts > 40 || results[1][0].attempts > 10) throw new DomainError('로그인 시도가 많아요. 15분 뒤 다시 시도해 주세요.', 429);
}
