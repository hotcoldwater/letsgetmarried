import 'server-only';
import webpush from 'web-push';
import { database, snapshot } from './db';
import { configuration } from './config';
import { reminderCandidates, subscriptionInput } from '../push-domain.mjs';
export const pushEnabled = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export async function dispatchPush() {
  if (!pushEnabled()) return { sent: 0 };
  const sql = database();
  const jobs = await sql`WITH selected AS (
    SELECT id FROM wedding.push_jobs WHERE sent_at IS NULL AND available_at <= now() AND attempts < 5
    AND created_at > now() - interval '2 days' ORDER BY available_at LIMIT 10 FOR UPDATE SKIP LOCKED
  ) UPDATE wedding.push_jobs j SET attempts = attempts + 1, available_at = now() + interval '5 minutes'
    FROM selected WHERE j.id = selected.id RETURNING j.*`;
  let sent = 0;
  for (const job of jobs) {
    const [sub] = await sql`SELECT subscription FROM wedding.push_subscriptions WHERE id = ${job.subscription_id}::uuid`;
    if (!sub) continue;
    try {
      await webpush.sendNotification(subscriptionInput(sub.subscription), JSON.stringify(job.payload), {
        TTL: 3600, timeout: 5000, vapidDetails: { subject: configuration().origin,
          publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
      });
      await sql`UPDATE wedding.push_jobs SET sent_at = now() WHERE id = ${job.id}`; sent++;
    } catch (e) {
      if ([404, 410].includes(e.statusCode)) await sql`DELETE FROM wedding.push_subscriptions WHERE id = ${job.subscription_id}::uuid`;
      // Keep transient failures in the queue; no endpoint/token/body is logged.
    }
  }
  return { sent };
}
export async function queueDailyReminders() {
  const sql = database();
  await sql`DELETE FROM wedding.sessions WHERE expires_at < now()`;
  await sql`DELETE FROM wedding.auth_attempts WHERE expires_at < now()`;
  if (!pushEnabled()) return { sent: 0 };
  const { state } = await snapshot();
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const subscriptions = await sql`SELECT id, reminder_days FROM wedding.push_subscriptions`;
  for (const sub of subscriptions) for (const reminder of reminderCandidates(state.events, date, sub.reminder_days)) {
    const id = `reminder:${sub.id}:${reminder.eventId}:${reminder.revision}:${date}`;
    const payload = { title: '우리의 결혼 준비', body: reminder.body, url: '/#timeline/' + encodeURIComponent(reminder.eventId), tag: id };
    await sql`INSERT INTO wedding.push_jobs(id, subscription_id, payload) VALUES (${id}, ${sub.id}::uuid, ${JSON.stringify(payload)}::jsonb) ON CONFLICT DO NOTHING`;
  }
  await sql`DELETE FROM wedding.push_jobs WHERE created_at < now() - interval '14 days'`;
  return dispatchPush();
}
