import { database } from '../../../../lib/server/db';
import { json, errorResponse, readJSON, sameOrigin } from '../../../../lib/server/http';
import { member, sessionToken, sessionCookie, limitAttempts } from '../../../../lib/server/auth';
import { accountRole, digest, newToken, tokenValid, passwordValid, hashPassword, verifyPassword } from '../../../../lib/auth-core.mjs';
import { DomainError } from '../../../../lib/domain.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request, context) {
  try {
    sameOrigin(request);
    const { action } = await context.params;
    if (!['login', 'logout', 'setup', 'password'].includes(action)) return json({ error: '요청을 찾을 수 없어요.' }, 404);
    const sql = database();
    if (action === 'logout') {
      const token = await sessionToken();
      if (tokenValid(token)) await sql`DELETE FROM wedding.sessions WHERE token_hash = ${digest(token)}`;
      await sessionCookie('', 0); return json({ ok: true });
    }
    const p = await readJSON(request, 4096);
    if (!p || typeof p !== 'object') throw new DomainError('입력 내용을 확인해 주세요.');
    const current = action === 'password' ? await member() : null;
    const role = current?.role || (action === 'setup' && ['groom', 'bride'].includes(p.role) ? p.role : accountRole(p.username));
    await limitAttempts(role);
    const token = newToken(), tokenHash = digest(token);
    if (action === 'setup') {
      if (!role || !tokenValid(p.token)) throw new DomainError('설정 링크를 확인해 주세요.');
      if (!passwordValid(p.password)) throw new DomainError('비밀번호는 15자 이상, 256자 이하로 입력해 주세요.');
      const [invite] = await sql`SELECT role FROM wedding.account_invites WHERE role = ${role} AND token_hash = ${digest(p.token)} AND used_at IS NULL AND expires_at > now()`;
      if (!invite) throw new DomainError('이미 사용했거나 만료된 설정 링크예요.', 403);
      const hash = await hashPassword(p.password);
      const rows = await sql`WITH claimed AS (
        UPDATE wedding.account_invites SET used_at = now() WHERE role = ${role} AND token_hash = ${digest(p.token)} AND used_at IS NULL AND expires_at > now() RETURNING role
      ), saved AS (
        UPDATE wedding.accounts SET password_hash = ${hash}, password_changed_at = now() WHERE role IN (SELECT role FROM claimed) AND password_hash IS NULL RETURNING role
      ) INSERT INTO wedding.sessions(token_hash, role) SELECT ${tokenHash}, role FROM saved RETURNING role`;
      if (!rows.length) throw new DomainError('이미 설정을 마쳤어요. 로그인해 주세요.', 409);
    } else {
      const [account] = await sql`SELECT role, password_hash FROM wedding.accounts WHERE role = ${role || ''}`;
      const matches = await verifyPassword(action === 'password' ? p.currentPassword : p.password, account?.password_hash);
      if (!matches) throw new DomainError('아이디 또는 비밀번호를 확인해 주세요.', 401);
      if (action === 'password') {
        if (!passwordValid(p.password)) throw new DomainError('새 비밀번호는 15자 이상, 256자 이하로 입력해 주세요.');
        const hash = await hashPassword(p.password);
        const results = await sql.transaction([
          sql`SELECT pg_advisory_xact_lock(hashtext(${'wedding-account-' + role}))`,
          sql`UPDATE wedding.accounts SET password_hash = ${hash}, password_changed_at = now() WHERE role = ${role} AND password_hash = ${account.password_hash} RETURNING role`,
          sql`DELETE FROM wedding.sessions WHERE role = ${role} AND EXISTS (SELECT 1 FROM wedding.accounts WHERE role = ${role} AND password_hash = ${hash})`,
          sql`INSERT INTO wedding.sessions(token_hash, role) SELECT ${tokenHash}, role FROM wedding.accounts WHERE role = ${role} AND password_hash = ${hash} RETURNING role`,
        ]);
        if (!results[3].length) throw new DomainError('비밀번호가 변경됐어요. 다시 로그인해 주세요.', 409);
      } else {
        const results = await sql.transaction([
          sql`SELECT pg_advisory_xact_lock(hashtext(${'wedding-account-' + role}))`,
          sql`INSERT INTO wedding.sessions(token_hash, role) SELECT ${tokenHash}, role FROM wedding.accounts WHERE role = ${role} AND password_hash = ${account.password_hash} RETURNING role`,
        ]);
        if (!results[1].length) throw new DomainError('비밀번호가 변경됐어요. 다시 로그인해 주세요.', 401);
      }
    }
    await sessionCookie(token);
    return json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
