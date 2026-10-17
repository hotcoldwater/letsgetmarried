import { member } from '../../../lib/server/auth';
import { database } from '../../../lib/server/db';
import { json, errorResponse } from '../../../lib/server/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { await member(); return json(await database()`SELECT version::text, actor, action, created_at FROM wedding.changes ORDER BY version DESC LIMIT 100`); }
  catch (e) { return errorResponse(e); }
}
