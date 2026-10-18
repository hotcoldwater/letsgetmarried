'use client';
import Brand from './brand';
import { useEffect, useState } from 'react';
import { ACCOUNTS } from '../lib/account-names.mjs';
export default function PasswordForm({ setup = false }) {
  const [invite, setInvite] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    if (!setup) return;
    const params = new URLSearchParams(location.hash.slice(1));
    if (['groom', 'bride'].includes(params.get('role')) && params.get('token')) setInvite({ role: params.get('role'), token: params.get('token') });
    else setMessage('전달받은 전용 설정 링크를 다시 열어 주세요.');
    window.history.replaceState(null, '', location.pathname);
  }, [setup]);
  async function submit(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirm')) { setMessage('두 비밀번호가 일치하지 않아요.'); return; }
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/auth/' + (setup ? 'setup' : 'password'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...invite, password: form.get('password'), currentPassword: form.get('currentPassword') }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      location.replace('/');
    } catch (e) { setMessage(e.message || '설정하지 못했어요. 다시 시도해 주세요.'); } finally { setBusy(false); }
  }
  return <main className="setup-page surface"><Brand welcome /><h1>{setup ? '우리 공간의 첫 비밀번호' : '비밀번호 변경'}</h1>{setup && invite && <p>{invite.role === 'groom' ? '오성현' : '정지윤'} 님 · {ACCOUNTS[invite.role]}</p>}<p>15자 이상의 기억하기 쉬운 문장으로 정해 주세요.<br />영문, 숫자, 한글, 공백을 사용할 수 있어요.</p><form className="live-form" onSubmit={submit}>{!setup && <label>현재 비밀번호<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} /></label>}<label>새 비밀번호<input name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={256} /></label><label>새 비밀번호 확인<input name="confirm" type="password" autoComplete="new-password" required minLength={15} maxLength={256} /></label>{message && <p className="live-error" role="alert">{message}</p>}<button className="primary-button" disabled={busy || (setup && !invite)}>{busy ? '설정 중…' : setup ? '비밀번호 설정하고 시작하기' : '변경하기'}</button></form>{!setup && <p className="live-subtle">변경하면 다른 기기는 다시 로그인해야 해요.</p>}<a href="/" className="text-button">처음으로 돌아가기</a></main>;
}
