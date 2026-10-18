'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Brand from './brand';
import LoginForm from './login-form';
import PushSettings from './push-settings';
import PlannerFields, { decisionLabels, expenseLabels } from './planner-forms';
import { PEOPLE, budgetSummary, expenseStatus, decisionBranch, decisionPath } from '../lib/domain.mjs';

const tabs = [['timeline', '일정', 'calendar'], ['decisions', '결정할 것', 'check'], ['budget', '예산', 'wallet']];
const active = list => list.filter(x => !x.archived);
const defaultFilter = view => view === 'budget' ? 'active' : 'all';
const won = n => n.toLocaleString('ko-KR') + '원';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function days(value) { if (!value) return '날짜 미정'; const n = Math.round((Date.parse(value) - Date.parse(today())) / 86400000); return n === 0 ? 'D-Day' : n > 0 ? `D−${n}` : `D+${-n}`; }
function Icon({ name }) {
  const shapes = { calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></>, check: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m7 12 3 3 7-7" /></>, wallet: <><path d="M19 8V5a2 2 0 0 0-2-2L5 6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8H5" /><path d="M21 12h-5v5h5" /></>, settings: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></>, arrow: <path d="m9 5 7 7-7 7" />, close: <path d="m6 6 12 12M6 18 18 6" /> };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}
const Button = ({ children, secondary = false, ...props }) => <button type="button" className={secondary ? 'secondary-button' : 'primary-button'} {...props}>{children}</button>;
const formTitles = { 'event.save': '일정', 'decision.save': '결정할 것', 'expense.save': '지출 기록', 'budget.save': '예산 설정', 'templates.add': '준비 항목 불러오기', 'candidate.save': '후보', 'attachment.add': '참고 링크', upload: '사진 · PDF', settings: '설정' };

export default function Planner() {
  const [snapshot, setSnapshot] = useState(null), [view, setView] = useState('timeline');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [status, setStatus] = useState(0), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [modal, setModal] = useState(null), [filter, setFilter] = useState(defaultFilter('timeline')), [query, setQuery] = useState('');
  const [targetId, setTargetId] = useState(''), [clockTick, tick] = useState(0);
  const [decisionParentId, setDecisionParentId] = useState(''), [deleteRequest, setDeleteRequest] = useState(null);
  const dialog = useRef(null), modalRef = useRef(null), deleteConfirmation = useRef(null);
  modalRef.current = modal;
  const state = snapshot?.state;
  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const r = await fetch('/api/workspace', { cache: 'no-store' }); const data = await r.json(); setStatus(r.status);
      if (!r.ok) throw new Error(data.error);
      setSnapshot(previous => previous && previous.version > data.version ? previous : data); setError('');
    } catch (e) { setError(e.message || '연결을 확인해 주세요.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    refresh();
    const route = () => {
      const [hash, target] = location.hash.slice(1).split('/');
      const next = hash === 'inbox' ? 'decisions' : tabs.some(([id]) => id === hash) ? hash : 'timeline';
      setView(next); setFilter(defaultFilter(next)); setQuery('');
      if (next !== 'decisions') setDecisionParentId('');
      if (target) { try { setTargetId(decodeURIComponent(target)); } catch {} }
    };
    route();
    const onFocus = () => { if (!document.hidden && !modalRef.current) refresh(); };
    window.addEventListener('hashchange', route); window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
    const timer = setInterval(() => tick(n => n + 1), 60000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => { clearInterval(timer); window.removeEventListener('hashchange', route); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [refresh]);
  useEffect(() => { if (modal && !dialog.current?.open) dialog.current?.showModal(); else if (!modal) dialog.current?.close(); }, [modal]);
  useEffect(() => { if (deleteRequest) deleteConfirmation.current?.focus(); }, [deleteRequest]);
  useEffect(() => { if (message) { const id = setTimeout(() => setMessage(''), 3500); return () => clearTimeout(id); } }, [message]);
  useEffect(() => {
    if (!state || !targetId) return;
    const list = view === 'timeline' ? state.events : view === 'budget' ? state.expenses : state.decisions;
    const record = list.find(r => r.id === targetId);
    if (record) setModal({ type: view === 'timeline' ? 'event.save' : view === 'budget' ? 'expense.save' : 'decision.save', record, version: snapshot.version });
    setTargetId('');
  }, [state, view, targetId, snapshot?.version]);
  useEffect(() => { if (state && decisionParentId && !state.decisions.some(d => d.id === decisionParentId)) setDecisionParentId(''); }, [state, decisionParentId]);
  function go(next) { setModal(null); setDeleteRequest(null); setDecisionParentId(''); setView(next); setFilter(defaultFilter(next)); setQuery(''); location.hash = next; window.scrollTo(0, 0); }
  function browseDecisions(parentId = '') { setModal(null); setDeleteRequest(null); setDecisionParentId(parentId); setView('decisions'); setFilter('all'); setQuery(''); location.hash = 'decisions'; window.scrollTo(0, 0); }
  function open(type, record = {}, extra = {}) { setError(''); setDeleteRequest(null); setModal({ type, record, version: snapshot.version, ...extra }); }
  async function logout() {
    try { const r = await fetch('/api/auth/logout', { method: 'POST' }); if (!r.ok) throw new Error(); setSnapshot(null); setModal(null); setStatus(401); setError(''); }
    catch { setError('로그아웃하지 못했어요.'); }
  }
  async function command(type, payload, version = snapshot.version, close = true) {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const r = await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: { type, payload }, version }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error + (r.status === 409 ? ' 창을 닫고 새로고침한 뒤 다시 저장해 주세요.' : ''));
      setSnapshot(previous => ({ ...previous, ...data })); setMessage(data.message);
      setDeleteRequest(null);
      if (close) setModal(null);
      else setModal(previous => previous ? { ...previous, version: data.version, record: data.state.decisions.find(d => d.id === previous.record.id) || previous.record } : null);
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function upload(f) {
    if (busyRef.current) return; const file = f.get('file'); if (!file?.size) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('25MB 이하 파일을 선택해 주세요.');
      const body = await compressImage(file);
      if (body.size > 4 * 1024 * 1024) throw new Error('압축 후에도 4MB를 넘어요. 더 작은 파일을 선택해 주세요.');
      const params = new URLSearchParams({ title: file.name.slice(0, 200), kind: modal.kind, targetId: modal.record.id, version: modal.version });
      const r = await fetch('/api/attachments?' + params, { method: 'POST', headers: { 'Content-Type': body.type || 'application/octet-stream' }, body });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setSnapshot(previous => ({ ...previous, ...data })); setModal(null); setMessage('자료를 저장했어요.');
    } catch (e) { setError(e.message); } finally { busyRef.current = false; setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); const f = new FormData(event.currentTarget), get = key => String(f.get(key) ?? ''), number = key => get(key).trim() === '' ? null : Number(get(key));
    const r = modal.record; let payload;
    switch (modal.type) {
      case 'event.save': payload = { id: r.id, title: get('title'), date: get('date'), time: get('time'), place: get('place'), memo: get('memo'), itemId: r.itemId || '', checklistId: get('checklistId'), newTasks: get('newTasks'), taskStates: (r.tasks || []).filter(t => !t.archived).map(t => ({ id: t.id, done: f.has('task-' + t.id) })) }; break;
      case 'decision.save': payload = { id: r.id, title: get('title'), status: get('status'), itemId: get('itemId'), parentId: get('parentId'), result: get('result'), memo: get('memo') }; break;
      case 'expense.save': payload = { id: r.id, title: get('title'), status: get('status'), categoryId: get('categoryId'), amount: number('amount'), paid: number('paid'), dueDate: get('dueDate'), detail: get('detail'), decisionId: get('decisionId') }; break;
      case 'budget.save': {
        const categories = state.settings.categories.map(c => ({ ...c, title: get('category-' + c.id), included: f.has('included-' + c.id) }));
        if (get('newCategory').trim()) categories.push({ title: get('newCategory'), included: f.has('newIncluded') });
        payload = { budget: number('budget'), scope: get('scope'), categories }; break;
      }
      case 'templates.add': payload = { ids: f.getAll('templates') }; break;
      case 'candidate.save': payload = { id: r.id, decisionId: modal.decisionId, title: get('title'), quote: number('quote'), detail: get('detail'), link: get('link') }; break;
      case 'attachment.add': payload = { kind: modal.kind, targetId: r.id, title: get('title'), url: get('url') }; break;
      case 'upload': return upload(f);
      default: return;
    }
    if (await command(modal.type, payload, modal.version)) {
      if (modal.type === 'decision.save') browseDecisions(payload.parentId);
    }
  }
  function matches(record, value = '') { return (record.title + ' ' + value).toLowerCase().includes(query.trim().toLowerCase()); }
  function toolbar(options) {
    return <div className="simple-toolbar"><label className="simple-search"><span className="sr-only">검색</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="이름으로 검색" /></label><label><span className="sr-only">표시할 항목</span><select value={filter} onChange={e => setFilter(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></div>;
  }
  function empty(text) { return <div className="simple-empty"><Icon name={tabs.find(t => t[0] === view)[2]} /><p>{text}</p></div>; }
  function timeline() {
    const events = state.events.filter(e => (filter === 'archived' ? e.archived : !e.archived) && (filter === 'active' ? !e.done : filter === 'done' ? e.done : true) && matches(e));
    events.sort((a, b) => (a.date || '9999') .localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || ''));
    const dated = active(state.events).filter(e => e.date).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return <>
      {dated.length > 1 && <section className="simple-journey" aria-label="날짜순 일정 흐름"><div className="simple-rail">{dated.map(e => <button type="button" key={e.id} onClick={() => open('event.save', e)}><time>{e.date.slice(5).replace('-', '.')}</time><span className={'simple-dot' + (e.id === 'wedding' ? ' wedding' : '')}>{e.id === 'wedding' ? '♡' : ''}</span><strong>{e.done && '✓ '}{e.title}</strong></button>)}</div></section>}
      {toolbar([['all', '전체'], ['active', '남은 일정'], ['done', '완료'], ['archived', '보관함']])}
      <section className="simple-list">{events.map((e, i) => <div key={e.id}>{(!i || events[i - 1].date?.slice(0, 7) !== e.date?.slice(0, 7)) && <h2 className="simple-month">{e.date ? `${e.date.slice(0, 4)}년 ${Number(e.date.slice(5, 7))}월` : '날짜 미정'}</h2>}<article className={'simple-row ' + (e.done ? 'is-done' : '')}>
        <label className="simple-complete"><span className="sr-only">{e.title} 완료</span><input type="checkbox" checked={e.done} disabled={busy || e.archived} onChange={() => command('event.done', { id: e.id, done: !e.done })} /></label>
        <button type="button" className="simple-record" onClick={() => open('event.save', e)}><span className="simple-day">{e.date ? e.date.slice(8) : '—'}<small>{e.date ? new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(e.date + 'T12:00:00+09:00')) : '미정'}</small></span><span className="simple-record-copy"><strong>{e.title}</strong><small>{[e.time, e.place].filter(Boolean).join(' · ') || '세부 일정은 나중에 정해도 돼요'}</small></span><Icon name="arrow" /></button>
      </article></div>)}{!events.length && empty(query ? '검색 결과가 없어요.' : '여기에 일정이 표시돼요. 새 일정을 추가해 보세요.')}</section>
    </>;
  }
  function decisions() {
    const parent = state.decisions.find(d => d.id === decisionParentId), path = decisionPath(state, decisionParentId);
    const scope = parent ? decisionBranch(state, parent.id).filter(d => d.id !== parent.id) : state.decisions;
    const searching = !!query.trim();
    const list = scope.filter(d => (searching || filter === 'archived' || (d.parentId || '') === decisionParentId || (!decisionParentId && !state.decisions.some(p => p.id === d.parentId))) && (filter === 'archived' ? d.archived : !d.archived) && (filter === 'active' ? d.status !== 'done' : ['todo', 'doing', 'done'].includes(filter) ? d.status === filter : true) && matches(d, d.result));
    const all = active(scope), done = all.filter(d => d.status === 'done').length;
    return <>
      {parent && <><nav className="simple-breadcrumbs" aria-label="결정 단계"><button type="button" onClick={() => browseDecisions()}>전체 결정</button>{path.map(d => <span key={d.id}><span aria-hidden="true"> / </span><button type="button" aria-current={d.id === parent.id ? 'page' : undefined} onClick={() => browseDecisions(d.id)}>{d.title}</button></span>)}</nav><div className="simple-parent"><div><small>하위 결정할 것</small><h2>{parent.title}</h2></div><button type="button" className="text-button" onClick={() => open('decision.save', parent)}>상위 결정 수정</button></div></>}
      <form key={decisionParentId} className="simple-quick" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await command('decision.save', { title: new FormData(form).get('title'), status: 'todo', parentId: decisionParentId })) form.reset(); }}><label className="sr-only" htmlFor="quick-decision">{parent ? '하위 결정 빠르게 추가' : '결정할 것 빠르게 추가'}</label><input id="quick-decision" name="title" required maxLength={200} disabled={parent?.archived} placeholder={parent ? '이 안에서 정할 것을 한 줄로 남겨요' : '생각난 것을 한 줄로 남겨요'} /><button className="primary-button" type="submit" disabled={busy || parent?.archived}>추가</button></form>
      <div className="simple-progress-label"><span>{all.length ? `${all.length}개 중 ${done}개 완료` : '하나씩 정해 나가요'}</span>{!parent && <button type="button" className="text-button" onClick={() => open('templates.add')}>준비 항목 불러오기</button>}</div>
      {toolbar([['all', '전체'], ['active', '남은 결정'], ['todo', '미정'], ['doing', '진행 중'], ['done', '완료'], ['archived', '보관함']])}
      <section className="simple-list">{list.map(d => { const children = active(state.decisions).filter(c => c.parentId === d.id); return <article className="simple-decision-card" key={d.id}><div className={'simple-row ' + (d.status === 'done' ? 'is-done' : '')}>
        <button type="button" className="simple-record" onClick={() => open('decision.save', d)}><span className="simple-record-copy"><small>{searching ? decisionPath(state, d.id).slice(0, -1).map(p => p.title).join(' / ') || '전체 결정' : state.items.find(i => i.id === d.itemId)?.title || '준비할 것'}</small><strong>{d.title}</strong>{d.result && <p>{d.result}</p>}</span></button>
        <label className={'simple-status ' + d.status}><span className="sr-only">{d.title} 상태</span><select aria-label={`${d.title} 상태`} value={d.status} disabled={busy || d.archived} onChange={e => command('decision.status', { id: d.id, status: e.target.value })}>{Object.entries(decisionLabels).map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      </div><button type="button" className="simple-child-link" aria-label={`${d.title} 하위 결정 ${children.length}개 열기`} onClick={() => browseDecisions(d.id)}><span>{children.length ? `하위 결정 ${children.length}개 · ${children.filter(c => c.status === 'done').length}개 완료` : '+ 하위 결정 추가하기'}</span><Icon name="arrow" /></button></article>; })}{!list.length && empty(query ? '검색 결과가 없어요.' : parent ? '이 결정에 필요한 세부 항목을 위에서 추가해 보세요.' : '정할 것이 떠오르면 바로 적어두세요.')}</section>
    </>;
  }
  function budget() {
    const b = budgetSummary(state);
    const expenses = state.expenses.filter(e => (filter === 'archived' ? e.archived : !e.archived) && (['estimated', 'confirmed', 'paid'].includes(filter) ? expenseStatus(e) === filter : true) && matches(e));
    const due = active(state.expenses).filter(e => e.dueDate && e.amount > e.paid && e.dueDate >= today() && e.dueDate <= new Date(Date.parse(today()) + 30 * 86400000).toISOString().slice(0, 10) && state.settings.categories.find(c => c.id === e.categoryId)?.included);
    return <>
      <section className="simple-budget surface"><div className="simple-budget-top"><div><small>{state.settings.scope}</small><h2>예상 총지출</h2><strong className="simple-total">{won(b.total)}</strong></div><button type="button" className="text-button" onClick={() => open('budget.save')}>예산 설정</button></div>
        <div className="simple-budget-balance"><span>목표 {won(b.budget)}</span><strong className={b.remaining < 0 ? 'simple-danger' : ''}>{won(Math.abs(b.remaining))} {b.remaining < 0 ? '초과' : '여유'}</strong></div>
        <div className="live-track" role="img" aria-label={`지급 완료 ${won(b.paid)}, 확정 미지급 ${won(b.committed)}, 예상 ${won(b.estimated)}, 목표 ${won(b.budget)}`}><div className="live-segment paid" style={{ width: b.paid / b.axis * 100 + '%' }} /><div className="live-segment committed" style={{ width: b.committed / b.axis * 100 + '%' }} /><div className="live-segment estimated" style={{ width: b.estimated / b.axis * 100 + '%' }} /><div className="live-target" style={{ left: b.budget / b.axis * 100 + '%' }}><span>목표</span></div>{b.remaining < 0 && <div className="live-over" style={{ left: b.budget / b.axis * 100 + '%', width: -b.remaining / b.axis * 100 + '%' }} />}</div>
        <div className="simple-budget-legend">{[['paid', '지급 완료', b.paid], ['confirmed', '확정 미지급', b.committed], ['estimated', '예상', b.estimated]].map(([c, title, value]) => <div key={c}><span><i className={c} />{title}</span><strong>{won(value)}</strong></div>)}</div>
        {due.length > 0 && <p className="simple-due">30일 안에 결제 예정 · {due.length}건 / {won(due.reduce((sum, e) => sum + e.amount - e.paid, 0))}</p>}
      </section>
      <details className="simple-category-summary"><summary>분류별 합계</summary>{b.rows.map(c => <div key={c.id}><span>{c.title}{!c.included && ' · 예산 제외'}</span><strong>{won(c.total)}</strong></div>)}</details>
      {toolbar([['active', '전체 지출'], ['estimated', '예상'], ['confirmed', '확정'], ['paid', '지급 완료'], ['archived', '보관함']])}
      <section className="simple-list">{expenses.map(e => <article className="simple-row" key={e.id}><button type="button" className="simple-record" onClick={() => open('expense.save', e)}><span className="simple-record-copy"><small>{state.settings.categories.find(c => c.id === e.categoryId)?.title}<span className={'simple-tag ' + expenseStatus(e)}>{expenseLabels[expenseStatus(e)]}</span></small><strong>{e.title}</strong><small>{e.dueDate && e.amount > e.paid ? `${e.dueDate.replaceAll('-', '.')} 결제 예정 · ` : ''}지급 {won(e.paid)}</small></span><span className="simple-expense-amount"><strong>{won(e.amount)}</strong><small>남은 금액 {won(e.amount - e.paid)}</small></span><Icon name="arrow" /></button></article>)}{!expenses.length && empty(query ? '검색 결과가 없어요.' : '견적이나 지출을 기록하면 예산을 바로 확인할 수 있어요.')}</section>
    </>;
  }
  function related(kind, record) {
    const files = state.attachments.filter(a => a.kind === kind && a.targetId === record.id);
    return <details className="simple-more simple-related"><summary>참고 자료{files.length ? ` (${files.length})` : ''}</summary><div className="simple-files">{files.map(a => <div className="simple-file-row" key={a.id}><a href={a.url || '/api/attachments/' + a.id} target="_blank" rel="noopener noreferrer">{a.title} ↗</a><button type="button" className="text-button simple-delete" aria-label={`${a.title} 삭제`} disabled={busy} onClick={() => setDeleteRequest({ kind: 'attachment', record: a })}>삭제</button></div>)}</div><div className="simple-actions"><Button secondary disabled={busy} onClick={() => open('attachment.add', record, { kind })}>링크 추가</Button>{snapshot.storageEnabled && <Button secondary disabled={busy} onClick={() => open('upload', record, { kind })}>사진 · PDF</Button>}</div></details>;
  }
  function deletion() {
    if (!deleteRequest) return null;
    const { kind, record, decisionId } = deleteRequest;
    const branch = kind === 'decision' ? decisionBranch(state, record.id) : [];
    return <section className="simple-delete-confirm" role="region" aria-label="삭제 확인" ref={deleteConfirmation} tabIndex={-1}><strong>‘{record.title}’ 항목을 삭제할까요?</strong>
      <p>{branch.length > 1 ? `하위 결정 ${branch.length - 1}개와 후보·참고 자료도 함께 삭제됩니다. ` : '삭제한 항목은 되돌릴 수 없어요. '}{kind === 'expense' ? '지급 기록을 포함해 예산 합계에서도 제외됩니다.' : kind === 'decision' || kind === 'candidate' ? '이미 기록한 지출 금액은 유지됩니다.' : ''}{kind === 'event' && record.id === 'wedding' ? ' 상단의 결혼식 날짜도 지워집니다.' : ''}</p>
      <div className="simple-actions"><Button secondary disabled={busy} onClick={() => setDeleteRequest(null)}>취소</Button><button type="button" className="primary-button simple-delete-button" disabled={busy} onClick={async () => {
        const keepOpen = kind === 'attachment' || kind === 'candidate' && modal.type !== 'candidate.save';
        if (await command(kind + '.delete', { id: record.id, ...(decisionId ? { decisionId } : {}) }, modal.version, !keepOpen)) {
          if (kind === 'decision' && branch.some(d => d.id === decisionParentId)) setDecisionParentId(record.parentId || '');
        }
      }}>{busy ? '삭제 중…' : '삭제하기'}</button></div></section>;
  }
  function extras() {
    const r = modal.record, kind = modal.type.split('.')[0];
    if (!r.id || !['event.save', 'decision.save', 'expense.save', 'candidate.save'].includes(modal.type)) return null;
    return <>
      {kind === 'decision' && <section className="simple-subdecisions"><div className="simple-parent"><h3>하위 결정</h3><button type="button" className="text-button" onClick={() => browseDecisions(r.id)}>목록으로 보기 →</button></div>{active(state.decisions).filter(d => d.parentId === r.id).map(d => <button key={d.id} type="button" className="simple-child-link" onClick={() => open('decision.save', d)}><span>{d.title}</span><small>{decisionLabels[d.status]}</small><Icon name="arrow" /></button>)}<Button secondary disabled={busy || r.archived} onClick={() => open('decision.save', { parentId: r.id, itemId: r.itemId, status: 'todo' })}>+ 하위 결정 추가</Button></section>}
      {kind === 'decision' && <details className="simple-more"><summary>후보 비교{r.options?.length ? ` (${active(r.options).length})` : ''}</summary>{r.options?.map(o => <div className="simple-candidate" key={o.id}><div><strong>{o.title}{o.archived ? ' · 보관됨' : ''}</strong>{o.quote != null && <small>{won(o.quote)}</small>}</div>{o.detail && <p>{o.detail}</p>}{o.link && <a href={o.link} target="_blank" rel="noopener noreferrer">참고 링크 ↗</a>}<div className="simple-actions">{!o.archived && <Button secondary disabled={busy || r.archived} onClick={() => command('decision.select', { id: r.id, optionId: o.id }, modal.version)}>이 후보로 결정</Button>}<button type="button" className="text-button" disabled={busy} onClick={() => open('candidate.save', o, { decisionId: r.id })}>수정</button><button type="button" className="text-button simple-delete" disabled={busy} onClick={() => setDeleteRequest({ kind: 'candidate', record: o, decisionId: r.id })}>삭제</button></div>{related('candidate', o)}</div>)}<Button secondary disabled={busy || r.archived} onClick={() => open('candidate.save', {}, { decisionId: r.id })}>후보 추가</Button></details>}
      {related(kind, r)}
      {kind === 'decision' && r.itemId && state.attachments.some(a => a.kind === 'item' && a.targetId === r.itemId) && related('item', state.items.find(i => i.id === r.itemId))}
      <div className="simple-record-actions">{['event', 'decision', 'expense'].includes(kind) && r.id !== 'wedding' && (kind !== 'expense' || !r.paid || r.archived) && <button type="button" className="text-button" disabled={busy} onClick={() => command(kind + '.archive', { id: r.id, archived: !r.archived }, modal.version)}>{r.archived ? '보관함에서 복원' : '보관함으로 옮기기'}</button>}<button type="button" className="text-button simple-delete" disabled={busy} onClick={() => setDeleteRequest({ kind, record: r, decisionId: modal.decisionId })}>삭제</button></div>
    </>;
  }
  if (loading) return <main className="setup-page surface" role="status"><Brand welcome /><p>기록을 불러오고 있어요…</p></main>;
  if (!state || status === 401 || status === 403) return <LoginForm onLogin={refresh} connectionError={status >= 500 ? error : ''} />;
  const wedding = state.events.find(e => e.id === 'wedding');
  const nav = tabs.map(([id, label, icon]) => <button type="button" key={id} aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}><Icon name={icon} /><span>{label}</span></button>);
  const title = tabs.find(t => t[0] === view)[1];
  return <div className="simple-app"><a className="skip-link" href="#main">본문으로 바로가기</a>
    <header className="simple-header"><div><a href="#timeline" className="app-logo" onClick={() => go('timeline')}><Brand /></a><nav className="simple-nav" aria-label="주요 화면">{nav}</nav><button type="button" className="simple-settings" aria-label="설정" onClick={() => open('settings')}><Icon name="settings" /></button></div></header>
    <main id="main" className="simple-main"><div className="simple-context"><span>오성현 &amp; 정지윤 <span>· {wedding?.date ? `${wedding.date.replaceAll('-', '.')} ${wedding.time}` : '결혼식 날짜 미정'}</span></span><strong>{days(wedding?.date)}</strong></div>
      <div className="simple-heading"><h1>{title}</h1>{view !== 'decisions' && <Button onClick={() => open(view === 'timeline' ? 'event.save' : 'expense.save')}>+ {view === 'timeline' ? '일정 추가' : '지출 추가'}</Button>}</div>
      {error && !modal && <p className="simple-error" role="alert">{error} <button type="button" className="text-button" onClick={refresh}>다시 불러오기</button></p>}
      {{ timeline, decisions, budget }[view]()}
      <footer className="simple-footer"><span>우리의 속도로, 하나씩.</span><button type="button" className="text-button" disabled={busy} onClick={refresh}>새로고침</button></footer>
    </main>
    <nav className="simple-mobile-nav" aria-label="모바일 주요 화면">{nav}</nav>
    {message && <div className="simple-toast" role="status">{message}</div>}
    <dialog className="simple-dialog" ref={dialog} aria-labelledby="simple-dialog-title" onCancel={e => { if (busy) e.preventDefault(); else setModal(null); }} onClose={() => { if (!busy) setModal(null); }}>
      {modal && <><div className="simple-dialog-head"><h2 id="simple-dialog-title">{formTitles[modal.type]}</h2><button type="button" className="simple-settings" aria-label="닫기" disabled={busy} onClick={() => setModal(null)}><Icon name="close" /></button></div>
        {modal.type === 'settings' ? <div className="simple-settings-body"><p>{PEOPLE[snapshot.user.role]} 님으로 로그인했어요.</p><div className="simple-actions"><a href="/account" className="secondary-button">비밀번호 변경</a><Button secondary onClick={logout}>로그아웃</Button></div><details className="simple-more"><summary>휴대폰 알림</summary><PushSettings publicKey={snapshot.pushKey} /></details>{state.attachments.length > 0 && <details className="simple-more"><summary>저장된 자료</summary><div className="simple-files">{state.attachments.map(a => <a key={a.id} href={a.url || '/api/attachments/' + a.id} target="_blank" rel="noopener noreferrer">{a.title} ↗</a>)}</div></details>}</div> : <>
          <form className="live-form simple-form" key={modal.type + (modal.record.id || '') + (modal.record.parentId || '')} onSubmit={submit}><fieldset disabled={busy}><PlannerFields modal={modal} state={state} /></fieldset>{error && <p className="simple-error" role="alert">{error}</p>}<button type="submit" className="primary-button simple-save" disabled={busy}>{busy ? '저장 중…' : modal.type === 'templates.add' ? '선택한 항목 추가' : '저장'}</button></form>{extras()}{deletion()}
        </>}
      </>}
    </dialog>
  </div>;
}

async function compressImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio);
    const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('사진을 처리하지 못했어요.')), 'image/jpeg', .86));
  } finally { URL.revokeObjectURL(url); }
}
