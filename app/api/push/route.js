import { member } from '../../../lib/server/auth';
import { database } from '../../../lib/server/db';
import { json, errorResponse, readJSON, sameOrigin } from '../../../lib/server/http';
import { subscriptionInput } from '../../../lib/push-domain.mjs';
import { DomainError } from '../../../lib/domain.mjs';
import { dispatchPush, pushEnabled } from '../../../lib/server/push';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    sameOrigin(request); const user = await member(), p = await readJSON(request, 10000), sql = database();
    const subscription = subscriptionInput(p.subscription);
    if (p.action === 'read') {
      const [sub] = await sql`SELECT changes, reminder_days FROM wedding.push_subscriptions WHERE endpoint = ${subscription.endpoint} AND role = ${user.role}`;
      return json({ enabled: Boolean(sub), changes: sub?.changes ?? true, reminderDays: sub?.reminder_days ?? [1] });
    }
    if (p.action === 'remove') {
      await sql`DELETE FROM wedding.push_subscriptions WHERE endpoint = ${subscription.endpoint} AND role = ${user.role}`;
      return json({ message: '이 기기의 알림을 껐어요.' });
    }
    if (!pushEnabled()) throw new DomainError('푸시 키를 먼저 설정해 주세요.', 503);
    if (p.action === 'test') {
      const [sub] = await sql`SELECT id FROM wedding.push_subscriptions WHERE endpoint = ${subscription.endpoint} AND role = ${user.role}`;
      if (!sub) throw new DomainError('먼저 이 기기의 알림을 켜 주세요.');
      const id = 'test:' + sub.id + ':' + Math.floor(Date.now() / 60000);
      const payload = JSON.stringify({ title: 'letsgetmarried', body: user.name + ' 님, 알림이 연결됐어요.', url: '/#notifications', tag: id });
      await sql`INSERT INTO wedding.push_jobs(id, subscription_id, payload) VALUES (${id}, ${sub.id}::uuid, ${payload}::jsonb) ON CONFLICT DO NOTHING`;
      const result = await dispatchPush(); return json({ message: result.sent ? '테스트 알림을 발송했어요.' : '알림이 대기 중이거나 이번 분에 이미 발송했어요.' });
    }
    if (p.action !== 'save' || typeof p.changes !== 'boolean' || !Array.isArray(p.reminderDays) || !p.reminderDays.every(n => [0, 1, 7].includes(n))) throw new DomainError('알림 설정을 확인해 주세요.');
    const id = crypto.randomUUID();
    // Serialized per-role registration, keeping at most six devices.
    const rows = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtext(${'wedding-push-' + user.role}))`,
      sql`INSERT INTO wedding.push_subscriptions(id, role, endpoint, subscription, changes, reminder_days)
        SELECT ${id}::uuid, ${user.role}, ${subscription.endpoint}, ${JSON.stringify(subscription)}::jsonb, ${p.changes}, ${JSON.stringify([...new Set(p.reminderDays)])}::jsonb
        WHERE (SELECT count(*) FROM wedding.push_subscriptions WHERE role = ${user.role}) < 6
           OR EXISTS(SELECT 1 FROM wedding.push_subscriptions WHERE endpoint = ${subscription.endpoint})
        ON CONFLICT(endpoint) DO UPDATE SET role = EXCLUDED.role, subscription = EXCLUDED.subscription, changes = EXCLUDED.changes, reminder_days = EXCLUDED.reminder_days RETURNING id`,
    ]);
    if (!rows[1].length) throw new DomainError('등록 가능한 기기는 6대예요. 이전 기기의 알림을 먼저 꺼 주세요.');
    return json({ message: '이 기기의 알림 설정을 저장했어요.' });
  } catch (e) { return errorResponse(e); }
}
