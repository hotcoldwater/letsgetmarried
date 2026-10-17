let failures = 0;
function check(name, valid) { console.log(`${valid ? 'OK' : '필요'}  ${name}`); if (!valid) failures++; }
check('Node.js 24 LTS', Number(process.versions.node.split('.')[0]) === 24);
for (const key of ['APP_URL', 'DATABASE_URL', 'GROOM_SETUP_TOKEN', 'BRIDE_SETUP_TOKEN']) check(key, !!process.env[key]?.trim());
for (const key of ['GROOM_SETUP_TOKEN', 'BRIDE_SETUP_TOKEN']) check(key + ' 형식', /^[A-Za-z0-9_-]{43}$/.test(process.env[key] || ''));
try { const url = new URL(process.env.DATABASE_URL); check('Postgres 연결 주소 + SSL', ['postgres:', 'postgresql:'].includes(url.protocol) && url.searchParams.get('sslmode') === 'require'); } catch { check('Postgres 연결 주소', false); }
try { const url = new URL(process.env.APP_URL); check('앱 주소', url.origin === 'http://localhost:3000' || url.protocol === 'https:'); } catch { check('앱 주소', false); }
console.log(process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_ENDPOINT_URL_S3 ? 'OK  사진/PDF 저장소 설정' : '선택  사진/PDF 저장소 미연결');
console.log(failures ? `필수 설정 ${failures}개를 확인해 주세요.` : '필수 값이 준비됐어요.');
process.exitCode = failures ? 1 : 0;
