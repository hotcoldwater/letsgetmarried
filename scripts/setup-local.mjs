import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';
const file = new URL('../.env.local', import.meta.url);
try { await access(file); console.log('.env.local이 이미 있어요. 기존 설정을 유지합니다.'); }
catch {
  let body = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const vapid = webpush.generateVAPIDKeys();
  for (const [key, value] of Object.entries({ GROOM_SETUP_TOKEN: randomBytes(32).toString('base64url'), BRIDE_SETUP_TOKEN: randomBytes(32).toString('base64url'), CRON_SECRET: randomBytes(32).toString('base64url'), VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey })) body = body.replace(new RegExp('^' + key + '=$', 'm'), key + '=' + value);
  await writeFile(file, body, { flag: 'wx', mode: 0o600 });
  console.log('.env.local을 만들었어요. 로그인·DB·이메일 값을 입력해 주세요. 비밀 키는 출력하지 않았어요.');
}
