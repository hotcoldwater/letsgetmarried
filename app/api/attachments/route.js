import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { member } from '../../../lib/server/auth';
import { commit } from '../../../lib/server/db';
import { storage, detectFile } from '../../../lib/server/storage';
import { json, sameOrigin, errorResponse } from '../../../lib/server/http';
import { DomainError, text } from '../../../lib/domain.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  let client, key, saved = false;
  try {
    sameOrigin(request); const user = await member();
    const params = new URL(request.url).searchParams;
    const title = text(params.get('title')), kind = params.get('kind'), targetId = params.get('targetId');
    const version = Number(params.get('version'));
    const limit = 4 * 1024 * 1024;
    const reader = request.body?.getReader(); if (!reader) throw new DomainError('파일이 비어 있어요.');
    const chunks = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length;
      if (size > limit) { await reader.cancel(); throw new DomainError('파일은 4MB 이하로 첨부해 주세요.', 413); } chunks.push(value); }
    const body = new Uint8Array(size); let offset = 0; for (const c of chunks) { body.set(c, offset); offset += c.length; }
    const file = detectFile(body); key = `our-wedding/${crypto.randomUUID()}.${file.ext}`; client = storage();
    await client.send(new PutObjectCommand({ Bucket: process.env.ATTACHMENT_BUCKET, Key: key, Body: body, ContentType: file.type }));
    const result = await commit({ type: 'attachment.add', payload: { title, kind, targetId } }, user.role, version, { key, type: file.type, size });
    saved = true; return json(result);
  } catch (e) {
    if (client && key && !saved) { try { await client.send(new DeleteObjectCommand({ Bucket: process.env.ATTACHMENT_BUCKET, Key: key })); } catch { console.error('Attachment cleanup failed; inspect private bucket for unreferenced objects.'); } }
    return errorResponse(e);
  }
}
