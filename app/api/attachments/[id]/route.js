import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { member } from '../../../../lib/server/auth';
import { snapshot } from '../../../../lib/server/db';
import { storage } from '../../../../lib/server/storage';
import { errorResponse } from '../../../../lib/server/http';
import { DomainError } from '../../../../lib/domain.mjs';
export const dynamic = 'force-dynamic';
export async function GET(_request, context) {
  try {
    await member(); const { id } = await context.params;
    const { state } = await snapshot(); const file = state.attachments.find(a => a.id === id && a.key);
    if (!file) throw new DomainError('자료를 찾지 못했어요.', 404);
    const url = await getSignedUrl(storage(), new GetObjectCommand({ Bucket: process.env.ATTACHMENT_BUCKET, Key: file.key,
      ResponseContentType: file.type,
      ResponseContentDisposition: `${file.type.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.title).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}` }), { expiresIn: 60 });
    return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store' } });
  } catch (e) { return errorResponse(e); }
}
