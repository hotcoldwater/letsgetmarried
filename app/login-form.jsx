'use client';
import Brand from './brand';
import { useState } from 'react';
export default function LoginForm({ onLogin, connectionError }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      await onLogin();
    } catch (e) { setError(e.message || '로그인하지 못했어요.'); } finally { setBusy(false); }
  }
  return <main className="setup-page surface"><Brand welcome /><h1>성현과 지윤의<br />작은 시작을 함께</h1><p>2027년 9월 25일 오후 2시.<br />둘만의 공간에서 결혼 준비를 이어가요.</p><form className="live-form" onSubmit={submit}><label>아이디<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>{(error || connectionError) && <p className="live-error" role="alert">{error || connectionError}</p>}<button className="primary-button" disabled={busy}>{busy ? '확인 중…' : '우리의 준비 시작하기'}</button></form><p className="live-subtle">처음 방문했다면 전달받은 전용 링크에서 비밀번호를 설정해 주세요.</p></main>;
}
