'use client';
import { useEffect, useState } from 'react';
export default function PushSettings({ publicKey }) {
  const [enabled, setEnabled] = useState(false), [changes, setChanges] = useState(true), [days, setDays] = useState([1]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function post(action, subscription) {
    const response = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, subscription: subscription.toJSON(), changes, reminderDays: days }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
  }
  useEffect(() => {
    let ignore = false;
    if ('serviceWorker' in navigator && 'PushManager' in window) navigator.serviceWorker.ready.then(async registration => {
      const sub = await registration.pushManager.getSubscription(); if (!sub) return;
      const data = await post('read', sub); if (!ignore) { setEnabled(data.enabled); setChanges(data.changes); setDays(data.reminderDays); }
    }).catch(() => {});
    return () => { ignore = true; };
  }, []);
  async function action(type) {
    setMessage('');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setMessage('아이폰은 Safari에서 홈 화면에 추가한 뒤 다시 열어 주세요.'); return; }
    if (/iPhone|iPad/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) { setMessage('Safari 공유 메뉴 → 홈 화면에 추가 → 홈 화면 아이콘으로 열어 주세요.'); return; }
    setBusy(true);
    try {
      // Request permission directly from this user gesture, before network awaits.
      if (type === 'save' && Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') throw new Error('알림이 허용되지 않았어요. 사이트 안의 알림은 계속 확인할 수 있어요.');
      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (!sub && type === 'save') {
        const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - publicKey.length % 4) % 4);
        sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(base64), c => c.charCodeAt(0)) });
      }
      if (!sub) throw new Error('먼저 알림을 켜 주세요.');
      const data = await post(type, sub);
      if (type === 'remove') { await sub.unsubscribe(); setEnabled(false); } else if (type === 'save') setEnabled(true);
      setMessage(data.message);
    } catch (e) { setMessage(e.message || '알림 설정을 확인해 주세요.'); } finally { setBusy(false); }
  }
  return <section className="live-card surface"><h3>이 기기의 휴대폰 알림</h3><p className="live-subtle">아이폰은 iOS 16.4 이상에서 홈 화면에 추가 후 사용할 수 있어요. 실제 수신은 HTTPS 연결과 기기의 허용 설정이 필요해요.</p><div className="live-form"><label className="check-label"><input type="checkbox" checked={changes} onChange={e => setChanges(e.target.checked)} />새 의견 · 동의 요청 · 변경 알림</label><div className="live-row">{[[7, '7일 전'], [1, '하루 전'], [0, '당일']].map(([n, label]) => <label key={n} className="check-label"><input type="checkbox" checked={days.includes(n)} onChange={e => setDays(e.target.checked ? [...days, n] : days.filter(d => d !== n))} />{label}</label>)}</div><p className="live-subtle">일정 알림은 두 사람이 동의한 일정을 기준으로 매일 한국 시간 오전 9~10시 사이에 발송돼요.</p><div className="live-row"><button type="button" className="primary-button" disabled={busy || !publicKey} onClick={() => action('save')}>{enabled ? '알림 설정 저장' : '이 기기 알림 켜기'}</button>{enabled && <><button type="button" className="secondary-button" disabled={busy} onClick={() => action('test')}>테스트 알림</button><button type="button" className="secondary-button" disabled={busy} onClick={() => action('remove')}>알림 끄기</button></>}</div>{!publicKey && <p className="live-subtle">알림 연결을 준비 중이에요.</p>}{message && <p className="live-subtle" role="status">{message}</p>}</div></section>;
}
