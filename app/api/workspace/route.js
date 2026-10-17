import { member } from '../../../lib/server/auth';
import { snapshot, commit } from '../../../lib/server/db';
import { errorResponse, json, readJSON, sameOrigin } from '../../../lib/server/http';
import { DomainError } from '../../../lib/domain.mjs';
import { after } from 'next/server';
import { dispatchPush, pushEnabled } from '../../../lib/server/push';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { const user = await member(); return json({ ...(await snapshot()), user, pushKey: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : '', storageEnabled: Boolean(process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_ENDPOINT_URL_S3) }); }
  catch (e) { return errorResponse(e); }
}
export async function POST(request) {
  try {
    sameOrigin(request); const user = await member(); const { command, version } = await readJSON(request);
    if (command?.type === 'attachment.add' && !command.payload?.url) throw new DomainError('파일 업로드 경로를 사용해 주세요.');
    const result = await commit(command, user.role, version);
    after(async () => { try { await dispatchPush(); } catch { console.error('Push dispatch deferred.'); } });
    return json(result);
  } catch (e) { return errorResponse(e); }
}
