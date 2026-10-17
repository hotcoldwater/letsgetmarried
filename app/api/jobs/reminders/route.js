import { timingSafeEqual } from 'node:crypto';
import { queueDailyReminders } from '../../../../lib/server/push';
import { json, errorResponse } from '../../../../lib/server/http';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!expected || expected.length < 32 || !actual || Buffer.byteLength(actual) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return json({ error: '인증이 필요해요.' }, 401);
  try { return json(await queueDailyReminders()); } catch (e) { return errorResponse(e); }
}
// Vercel Cron sends GET with Authorization: Bearer CRON_SECRET.
export const GET = POST;
