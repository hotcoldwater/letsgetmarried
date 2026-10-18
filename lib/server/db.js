import 'server-only';
import { neon } from '@neondatabase/serverless';
import { applyCommand, normalizeState, DomainError } from '../domain.mjs';
export function database() { return neon(process.env.DATABASE_URL); }
export async function snapshot() {
  const rows = await database()`SELECT version::text, body FROM wedding.workspace WHERE id = 'our-wedding'`;
  if (!rows.length) throw new DomainError('초기 데이터 설정이 필요해요. npm run db:migrate를 실행해 주세요.', 503);
  return { version: Number(rows[0].version), state: normalizeState(rows[0].body) };
}
export async function commit(command, actor, expectedVersion, attachment) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new DomainError('데이터 버전을 확인해 주세요.');
  const current = await snapshot();
  if (current.version !== expectedVersion) throw new DomainError('상대방이 내용을 수정했어요. 새로고침 후 다시 저장해 주세요.', 409);
  const id = crypto.randomUUID(), now = new Date().toISOString();
  const result = applyCommand(current.state, command, actor, { id, now, attachment });
  const notification = result.state.notifications.find(n => n.id === id);
  const pushPayload = JSON.stringify({ title: 'letsgetmarried', body: notification?.title || '', url: '/#' + result.target + (notification?.entityId ? '/' + encodeURIComponent(notification.entityId) : ''), tag: id });
  // Compare-and-swap AND audit insert in a single SQL statement: no lost updates.
  const rows = await database()`WITH saved AS (
    UPDATE wedding.workspace SET body = ${JSON.stringify(result.state)}::jsonb,
      version = version + 1, updated_at = now()
    WHERE id = 'our-wedding' AND version = ${expectedVersion}
    RETURNING id, version
  ), backed_up AS (
    INSERT INTO wedding.workspace_backups (name, version, body)
    SELECT ${'before-delete-' + id}, ${current.version}, ${JSON.stringify(current.state)}::jsonb
    FROM saved WHERE ${command.type.endsWith('.delete')}
    ON CONFLICT DO NOTHING RETURNING name
  ), logged AS (
    INSERT INTO wedding.changes (id, workspace_id, version, actor, action)
    SELECT ${id}::uuid, id, version, ${actor}, ${command.type} FROM saved RETURNING id
  ), queued AS (
    INSERT INTO wedding.push_jobs (id, subscription_id, payload)
    SELECT ${id} || ':' || s.id::text, s.id, ${pushPayload}::jsonb
    FROM wedding.push_subscriptions s, saved
    WHERE s.role = ${notification?.to || ''} AND s.changes = true
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT version::text FROM saved`;
  if (!rows.length) throw new DomainError('동시에 변경된 내용이 있어요. 새로고침 후 다시 저장해 주세요.', 409);
  return { state: result.state, version: Number(rows[0].version), message: result.message };
}
