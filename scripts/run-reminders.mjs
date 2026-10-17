if (!process.env.CRON_SECRET || !process.env.APP_URL) throw new Error('APP_URL / CRON_SECRET 설정이 필요해요.');
try {
  const response = await fetch(new URL('/api/jobs/reminders', process.env.APP_URL), { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.CRON_SECRET } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const result = await response.json(); console.log('예약 알림 작업 완료. 발송:', result.sent);
} catch { console.error('알림 작업 실패. 먼저 npm run dev로 서버를 실행해 주세요.'); process.exitCode = 1; }
