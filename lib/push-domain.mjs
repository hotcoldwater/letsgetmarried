import { DomainError } from './domain.mjs';
export function subscriptionInput(value) {
  let url; try { url = new URL(value?.endpoint); } catch { throw new DomainError('푸시 주소를 확인해 주세요.'); }
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host === 'push.apple.com' || host.endsWith('.push.apple.com');
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowed || url.href.length > 4096) throw new DomainError('지원하지 않는 푸시 서비스예요.');
  if (!/^[A-Za-z0-9_-]{87}=?$/.test(value?.keys?.p256dh || '') || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(value?.keys?.auth || '')) throw new DomainError('푸시 암호화 키를 확인해 주세요.');
  return { endpoint: url.href, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}
export function reminderCandidates(events, dateString, offsets) {
  return events.filter(e => e.date && !e.done && !e.archived).flatMap(e => {
    const days = Math.round((Date.parse(e.date) - Date.parse(dateString)) / 86400000);
    return offsets.includes(days) ? [{ eventId: e.id, revision: e.revision, date: e.date, days,
      body: `${days === 0 ? '오늘' : days + '일 뒤'} ${e.title}${e.time ? ' · ' + e.time : ''}` }] : [];
  });
}
