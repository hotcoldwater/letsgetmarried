import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';
import { DomainError } from '../domain.mjs';
export function storage() {
  const keys = ['AWS_ENDPOINT_URL_S3', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'ATTACHMENT_BUCKET'];
  if (keys.some(k => !process.env[k])) throw new DomainError('사진·PDF 저장소 설정이 필요해요.', 503);
  return new S3Client({ endpoint: process.env.AWS_ENDPOINT_URL_S3, region: process.env.AWS_REGION, forcePathStyle: true,
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } });
}
export function detectFile(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return { type: 'image/png', ext: 'png' };
  const head = new TextDecoder().decode(bytes.slice(0, 12));
  if (head.startsWith('RIFF') && head.slice(8) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  if (head.startsWith('%PDF-')) return { type: 'application/pdf', ext: 'pdf' };
  throw new DomainError('JPEG, PNG, WebP 사진 또는 PDF를 선택해 주세요.');
}
