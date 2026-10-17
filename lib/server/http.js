import 'server-only';
import { configuration } from './config';
import { DomainError } from '../domain.mjs';
export function json(value, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
export function sameOrigin(request) {
  if (request.headers.get('origin') !== configuration().origin) throw new DomainError('같은 사이트에서 다시 시도해 주세요.', 403);
}
export async function readJSON(request, limit = 50000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new DomainError('JSON 요청이 필요해요.', 415);
  const reader = request.body?.getReader(); if (!reader) throw new DomainError('요청이 비어 있어요.');
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new DomainError('요청이 너무 커요.', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new DomainError('요청 내용을 읽지 못했어요.'); }
}
export function errorResponse(error) {
  if (error instanceof DomainError) return json({ error: error.message }, error.status);
  // Database/auth errors may contain credentials or queries. Do not send them to clients.
  console.error('Wedding API request failed:', error?.name || 'Error');
  return json({ error: '서버에 연결하지 못했어요. 잠시 후 새로고침해 주세요. 처음 실행한 경우에는 연결 설정을 확인해 주세요.' }, 503);
}
