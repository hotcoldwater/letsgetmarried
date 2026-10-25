'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Brand from './brand';
import LoginForm from './login-form';
import PushSettings from './push-settings';
import PlannerFields from './planner-forms';
import PlanningCategories from './planning-categories';
import { ScheduleTimeline, ScheduleTable, DecisionTable, PlanningFilters } from './planner-table';
import { PEOPLE, budgetSummary, decisionBranch, preparationTemplates } from '../lib/domain.mjs';
import { createWorkspaceQueue, defaultPlannerViews, fieldRecord, recordAnchor, visibleDecisions, visibleEvents, visibleExpenseGroups } from '../lib/inline-planner.mjs';
import { parseMoneyInput } from '../lib/money-input.mjs';
import useInlineSaves from './use-inline-saves';
import { InlineContext, EditableField, QuickAdd } from './inline-fields';
import { BudgetCategories, won } from './inline-records';

const tabs = [['timeline', '일정', 'calendar'], ['decisions', '결정할 것', 'check'], ['budget', '예산', 'wallet']];
const defaultFilter = view => view === 'budget' ? 'active' : 'all';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function days(value) {
  if (!value) return '날짜 미정';
  const n = Math.round((Date.parse(value) - Date.parse(today())) / 86400000);
  return n === 0 ? 'D-Day' : n > 0 ? `D−${n}` : `D+${-n}`;
}
function Icon({ name }) {
  const shapes = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></>,
    check: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m7 12 3 3 7-7" /></>,
    wallet: <><path d="M19 8V5a2 2 0 0 0-2-2L5 6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8H5" /><path d="M21 12h-5v5h5" /></>,
    settings: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}
const formTitles = { 'event.save': '일정 추가', 'expense.save': '세부항목 추가', 'templates.add': '준비 항목 불러오기', 'attachment.add': '참고 링크 추가', upload: '사진 · PDF 추가', settings: '설정', categories: '카테고리 관리' };
async function responseJSON(response) {
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || '저장하지 못했어요. 연결을 확인해 주세요.'); error.status = response.status; throw error; }
  return data;
}

export default function Planner() {
  const [snapshot, setSnapshot] = useState(null), snapshotRef = useRef(null);
  const [view, setView] = useState('timeline'), viewRef = useRef('timeline');
  const [loading, setLoading] = useState(true), [status, setStatus] = useState(0);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [pending, setPending] = useState(0), [modalBusy, setModalBusy] = useState(false);
  const [modal, setModal] = useState(null), [deleteRequest, setDeleteRequest] = useState(null);
  const [viewOptions, setViewOptions] = useState(defaultPlannerViews), [ordering, setOrdering] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [targetId, setTargetId] = useState(''), [, tick] = useState(0);
  const dialog = useRef(null), deleteDialog = useRef(null), modalRef = useRef(null);
  const scrollPositions = useRef({}), tableScrollPositions = useRef({}), queueRef = useRef(null), refreshId = useRef(0);
  modalRef.current = modal;
  const state = snapshot?.state;
  const options = viewOptions[view], { filter, query, category, sort } = options;
  const changeOptions = patch => setViewOptions(previous => ({ ...previous, [view]: { ...previous[view], ...patch } }));
  const setFilter = filter => changeOptions({ filter }), setQuery = query => changeOptions({ query });
  const toggleRow = key => {
    setExpandedRows(previous => ({ ...previous, [key]: !previous[key] }));
    if (expandedRows[key]) requestAnimationFrame(() => document.getElementById(key)?.querySelector('.planner-expand')?.focus({ preventScroll: true }));
  };
  const selectedItem = category === 'all' || category === 'unassigned' ? '' : category;
  const receive = useCallback(data => {
    if (snapshotRef.current && data.version < snapshotRef.current.version) return;
    snapshotRef.current = { ...snapshotRef.current, ...data };
    setSnapshot(snapshotRef.current);
  }, []);
  if (!queueRef.current) queueRef.current = createWorkspaceQueue({
    getSnapshot: () => snapshotRef.current,
    receive,
    post: async (command, version) => responseJSON(await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, version }) })),
    reload: async () => responseJSON(await fetch('/api/workspace', { cache: 'no-store' })),
    pendingChanged: setPending,
  });
  const queue = queueRef.current, saves = useInlineSaves(queue, snapshotRef);
  const refresh = useCallback(async () => {
    if (queue.pending) return;
    const request = ++refreshId.current;
    try {
      const response = await fetch('/api/workspace', { cache: 'no-store' });
      const data = await responseJSON(response);
      if (request !== refreshId.current) return;
      setStatus(response.status); receive(data); setError('');
    } catch (e) {
      if (request !== refreshId.current) return;
      setStatus(e.status || 0); setError(e.message || '연결을 확인해 주세요.');
    } finally { setLoading(false); }
  }, [queue, receive]);
  const jump = useCallback((kind, id) => {
    const element = document.getElementById(recordAnchor(kind, id));
    if (!element) return;
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
    element.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    refresh();
    const route = () => {
      const [hash, target] = location.hash.slice(1).split('/');
      const next = hash === 'inbox' ? 'decisions' : tabs.some(([id]) => id === hash) ? hash : 'timeline';
      if (viewRef.current !== next) scrollPositions.current[viewRef.current] = window.scrollY;
      viewRef.current = next; setView(next); setOrdering(false);
      if (target) { try { setTargetId(decodeURIComponent(target)); } catch {} }
      else requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[next] || 0));
    };
    route();
    const onFocus = () => {
      if (!document.hidden && !modalRef.current && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) refresh();
    };
    window.addEventListener('hashchange', route); window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
    const timer = setInterval(() => tick(n => n + 1), 60000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => { clearInterval(timer); window.removeEventListener('hashchange', route); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [refresh]);
  useEffect(() => { if (modal && !dialog.current?.open) dialog.current?.showModal(); else if (!modal) dialog.current?.close(); }, [modal]);
  useEffect(() => { if (deleteRequest && !deleteDialog.current?.open) deleteDialog.current?.showModal(); else if (!deleteRequest) deleteDialog.current?.close(); }, [deleteRequest]);
  useEffect(() => { if (message) { const timer = setTimeout(() => setMessage(''), 3000); return () => clearTimeout(timer); } }, [message]);
  useEffect(() => {
    if (!state) return;
    setViewOptions(previous => {
      const missing = Object.keys(previous).filter(key => !['all', 'unassigned'].includes(previous[key].category) && !state.items.some(item => item.id === previous[key].category));
      if (!missing.length) return previous;
      return Object.fromEntries(Object.entries(previous).map(([key, value]) => [key, missing.includes(key) ? { ...value, category: 'all' } : value]));
    });
  }, [state?.items]);
  useEffect(() => {
    if (!state || !targetId) return;
    const kind = view !== 'budget' && state.items.some(item => item.id === targetId) ? 'item' : view === 'timeline' ? 'event' : view !== 'budget' ? 'decision' : targetId === 'settings' ? 'budget' : state.settings.categories.some(c => c.id === targetId) ? 'category' : 'expense';
    if (kind === 'item' && modal?.type !== 'categories') { open('categories'); return; }
    const record = (state[{ event: 'events', expense: 'expenses', decision: 'decisions' }[kind]] || []).find(r => r.id === targetId);
    if (record?.archived && filter !== 'archived') { setFilter('archived'); return; }
    const visible = kind === 'event' ? visibleEvents(state, query, filter, category, sort).some(r => r.id === targetId) : kind === 'decision' ? visibleDecisions(state, query, filter, category, sort).some(row => row.record.id === targetId && !row.context) : true;
    if (record && !visible) { changeOptions({ query: '', category: 'all', filter: record.archived ? 'archived' : 'all' }); return; }
    if (kind === 'event' || kind === 'decision') setExpandedRows(previous => ({ ...previous, [recordAnchor(kind, targetId)]: true }));
    const timer = requestAnimationFrame(() => { jump(kind, targetId); setTargetId(''); });
    return () => cancelAnimationFrame(timer);
  }, [state, targetId, view, filter, query, category, sort, modal?.type, jump]);

  function go(next) {
    saves.flush();
    if (next === viewRef.current) return;
    setModal(null); setDeleteRequest(null); location.hash = next;
  }
  function open(type, record = {}, extra = {}) { setError(''); setModal({ type, record, ...extra }); }
  async function logout() {
    if (!await saves.flush()) { setError('저장하지 못한 입력을 먼저 확인해 주세요.'); return; }
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' }); if (!r.ok) throw new Error('로그아웃하지 못했어요.');
      ++refreshId.current; snapshotRef.current = null; setSnapshot(null); setModal(null); setStatus(401);
    } catch (e) { setError(e.message); }
  }
  async function submit(event) {
    event.preventDefault(); if (modalBusy) return;
    const f = new FormData(event.currentTarget), get = key => String(f.get(key) ?? ''), number = key => parseMoneyInput(get(key));
    setModalBusy(true); setError('');
    try {
      let command;
      if (modal.type === 'event.save') command = { type: modal.type, payload: { title: get('title'), itemId: get('itemId'), date: get('date'), time: get('time'), place: get('place'), memo: get('memo'), checklistId: get('checklistId'), newTasks: get('newTasks') } };
      if (modal.type === 'expense.save') command = { type: modal.type, payload: { title: get('title'), status: get('status'), categoryId: get('categoryId'), amount: number('amount'), paid: number('paid'), dueDate: get('dueDate'), detail: get('detail'), decisionId: get('decisionId') } };
      if (modal.type === 'templates.add') command = { type: modal.type, payload: { ids: f.getAll('templates'), templates: preparationTemplates(state).map(t => ({ id: t.id, title: get('template-title-' + t.id), group: get('template-group-' + t.id) })) } };
      if (modal.type === 'attachment.add') command = { type: modal.type, payload: { kind: modal.kind, targetId: modal.record.id, title: get('title'), url: get('url') } };
      if (modal.type === 'upload') {
        const file = f.get('file');
        if (!file?.size) throw new Error('파일을 선택해 주세요.');
        if (file.size > 25 * 1024 * 1024) throw new Error('25MB 이하 파일을 선택해 주세요.');
        const body = await compressImage(file);
        if (body.size > 4 * 1024 * 1024) throw new Error('압축 후에도 4MB를 넘어요. 더 작은 파일을 선택해 주세요.');
        await queue.enqueue(async latest => {
          const params = new URLSearchParams({ title: file.name.slice(0, 200), kind: modal.kind, targetId: modal.record.id, version: latest.version });
          return responseJSON(await fetch('/api/attachments?' + params, { method: 'POST', headers: { 'Content-Type': body.type || 'application/octet-stream' }, body }));
        });
      } else {
        const saved = await queue.command(command);
        if (modal.type === 'expense.save') {
          setFilter('active'); setQuery('');
          setTargetId(saved.state.expenses.at(-1).id);
        }
        if (modal.type === 'event.save') {
          changeOptions({ filter: 'all', query: '' });
          setTargetId(saved.state.events.at(-1).id);
        }
      }
      setModal(null); setMessage('저장했어요.');
    } catch (e) { setError(e.message); } finally { setModalBusy(false); }
  }
  function toolbar(options, records, kind) {
    return <div className="inline-toolbar">
      <label className="inline-search"><span className="sr-only">제목과 내용 검색</span><input type="search" value={query} onChange={e => { setQuery(e.target.value); setOrdering(false); }} placeholder="제목·내용 검색" /></label>
      <label><span className="sr-only">표시할 항목</span><select value={filter} onChange={e => { setFilter(e.target.value); setOrdering(false); }}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {records.length > 1 && <label className="inline-jump"><span className="sr-only">항목으로 바로 이동</span><select value="" onChange={e => jump(kind, e.target.value)}><option value="">목차</option>{records.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>}
    </div>;
  }
  function timeline() {
    const events = visibleEvents(state, query, filter, category, sort);
    return <>
      <ScheduleTimeline onSelect={id => { changeOptions({ filter: 'all', query: '', category: 'all' }); setTargetId(id); }} />
      <PlanningFilters view={view} options={options} change={changeOptions} count={events.length} total={state.events.filter(e => filter === 'archived' ? e.archived : !e.archived).length} />
      <ScheduleTable records={events} sort={sort} onSort={sort => changeOptions({ sort })} expanded={expandedRows} toggle={toggleRow} scrollMemory={tableScrollPositions} />
    </>;
  }
  function decisions() {
    const rows = visibleDecisions(state, query, filter, category, sort), all = state.decisions.filter(d => !d.archived), done = all.filter(d => d.status === 'done').length;
    return <>
      <PlanningFilters view={view} options={options} change={patch => { changeOptions(patch); setOrdering(false); }} count={rows.filter(row => !row.context).length} total={state.decisions.filter(d => filter === 'archived' ? d.archived : !d.archived).length} />
      <QuickAdd label="결정할 것 빠르게 추가" placeholder={selectedItem ? `${state.items.find(item => item.id === selectedItem)?.title}에 정할 것을 추가해요` : '새로 정할 것을 한 줄로 남겨요'} create={async title => {
        const saved = await queue.command({ type: 'decision.save', payload: { title, status: 'todo', parentId: '', itemId: selectedItem } });
        changeOptions({ query: '', filter: 'all' }); setTargetId(saved.state.decisions.at(-1).id);
      }} />
      <div className="simple-progress-label"><span>{all.length ? `${all.length}개 중 ${done}개 완료` : '하나씩 정해 나가요'}</span><button type="button" className="text-button" onClick={() => open('templates.add')}>준비 항목 불러오기</button></div>
      <div className="simple-order-toolbar"><span>{ordering ? '같은 단계 안에서 위·아래로 이동해요.' : '하위 결정은 들여쓰기로 구분해요.'}</span><button type="button" className="text-button" aria-pressed={ordering} onClick={() => { setOrdering(v => !v); changeOptions({ filter: 'all', query: '', category: 'all', sort: { key: 'manual', direction: 'asc' } }); }}>{ordering ? '순서 편집 마치기' : '순서 편집'}</button></div>
      <DecisionTable rows={rows} sort={sort} onSort={sort => { changeOptions({ sort }); setOrdering(false); }} expanded={expandedRows} toggle={toggleRow} ordering={ordering} scrollMemory={tableScrollPositions} />
    </>;
  }
  function budget() {
    const b = budgetSummary(state);
    const groups = visibleExpenseGroups(state, query, filter), expenses = groups.flatMap(group => group.expenses);
    const due = state.expenses.filter(e => !e.archived && e.dueDate && e.amount > e.paid && e.dueDate >= today() && e.dueDate <= new Date(Date.parse(today()) + 30 * 86400000).toISOString().slice(0, 10) && state.settings.categories.find(c => c.id === e.categoryId)?.included);
    return <>
      <section id={recordAnchor('budget', 'settings')} tabIndex={-1} className="simple-budget surface">
        <div className="inline-budget-settings"><EditableField kind="budget" field="budget" label="목표 예산 (원)" type="number" required min="0" max="10000000000" step="1" /><EditableField kind="budget" field="scope" label="예산에 포함할 범위" multiline required maxLength={200} /></div>
        <h2>예상 총지출</h2><strong className="simple-total">{won(b.total)}</strong>
        <div className="simple-budget-balance"><span>목표 {won(b.budget)}</span><strong className={b.remaining < 0 ? 'simple-danger' : ''}>예산 {b.remaining < 0 ? '초과' : '여유'} {won(Math.abs(b.remaining))}</strong></div>
        <div className="live-track" role="img" aria-label={`지급 완료 ${won(b.paid)}, 확정 미지급 ${won(b.committed)}, 예상 ${won(b.estimated)}, 목표 ${won(b.budget)}`}><div className="live-segment paid" style={{ width: b.paid / b.axis * 100 + '%' }} /><div className="live-segment committed" style={{ width: b.committed / b.axis * 100 + '%' }} /><div className="live-segment estimated" style={{ width: b.estimated / b.axis * 100 + '%' }} /><div className="live-target" style={{ left: b.budget / b.axis * 100 + '%' }}><span>목표</span></div>{b.remaining < 0 && <div className="live-over" style={{ left: b.budget / b.axis * 100 + '%', width: -b.remaining / b.axis * 100 + '%' }} />}</div>
        <div className="simple-budget-legend">{[['paid', '지급 완료', b.paid], ['confirmed', '확정 미지급', b.committed], ['estimated', '예상', b.estimated]].map(([c, label, value]) => <div key={c}><span><i className={c} />{label}</span><strong>{won(value)}</strong></div>)}</div>
        {due.length > 0 && <p className="simple-due">30일 안에 결제 예정 · {due.length}건 / {won(due.reduce((sum, e) => sum + e.amount - e.paid, 0))}</p>}
      </section>
      {toolbar([['active', '전체 항목'], ['estimated', '예상'], ['confirmed', '확정'], ['paid', '지급 완료'], ['archived', '보관함']], expenses, 'expense')}
      <BudgetCategories summary={b} groups={groups} filtered={!!query.trim() || filter !== 'active'} archived={filter === 'archived'} onCategoryAdded={id => { setFilter('active'); setQuery(''); setTargetId(id); }} />
    </>;
  }

  if (loading) return <main className="setup-page surface" role="status"><Brand welcome /><p>기록을 불러오고 있어요…</p></main>;
  if (!state || status === 401 || status === 403) return <LoginForm onLogin={refresh} connectionError={status >= 500 ? error : ''} />;
  const wedding = state.events.find(e => e.id === 'wedding');
  const nav = tabs.map(([id, label, icon]) => <button type="button" key={id} aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}><Icon name={icon} /><span>{label}</span></button>);
  const failures = Object.entries(saves.drafts).filter(([, d]) => d.status === 'error'), editing = Object.values(saves.drafts).some(d => d.status === 'editing');
  const branch = deleteRequest?.kind === 'decision' ? decisionBranch(state, deleteRequest.record.id) : [];
  return <InlineContext.Provider value={{ state, queue, saves, open, remove: request => { setError(''); setDeleteRequest(request); }, storageEnabled: snapshot.storageEnabled }}>
    <div className="simple-app"><a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>본문으로 바로가기</a>
      <header className="simple-header"><div><a href="#timeline" className="app-logo" onClick={e => { e.preventDefault(); go('timeline'); }}><Brand /></a><nav className="simple-nav" aria-label="주요 화면">{nav}</nav><button type="button" className="simple-settings" aria-label="설정" onClick={() => open('settings')}><Icon name="settings" /></button></div></header>
      <main id="main" className={`simple-main ${view !== 'budget' ? 'planner-table-main' : ''}`} tabIndex={-1}>
        <div className="simple-context"><span>오성현 &amp; 정지윤 <span>· {wedding?.date ? `${wedding.date.replaceAll('-', '.')} ${wedding.time}` : '결혼식 날짜 미정'}</span></span><strong>{days(wedding?.date)}</strong></div>
        <div className="simple-heading"><h1>{tabs.find(t => t[0] === view)[1]}</h1>{view !== 'decisions' && <button type="button" className="primary-button" onClick={() => open(view === 'timeline' ? 'event.save' : 'expense.save', view === 'timeline' ? { itemId: selectedItem } : {})}>+ {view === 'timeline' ? '일정 추가' : '세부항목 추가'}</button>}</div>
        <div className="inline-save-overview"><span>입력 후 다른 곳을 누르면 자동 저장돼요.</span><strong role="status" className={failures.length ? 'simple-danger' : ''}>{failures.length ? `저장 실패 ${failures.length}건` : pending ? '저장 중…' : editing ? '입력 중' : '✓ 모든 변경사항 저장됨'}</strong></div>
        {failures.length > 0 && <div className="inline-unsaved" role="alert"><p>저장하지 못한 입력을 보관하고 있어요.</p>{failures.map(([key, draft]) => {
          let missing = false; try { fieldRecord(state, draft.config); } catch { missing = true; }
          if (missing) return <div key={key}><p>{draft.config.label} · 원래 항목이 삭제되었어요. 필요한 내용을 복사해 두세요.</p><textarea readOnly aria-label={`저장되지 않은 ${draft.config.label}`} value={String(draft.value)} /><button type="button" onClick={() => saves.discard(key)}>입력 지우기</button></div>;
          return <button type="button" key={key} onClick={() => {
          const kind = draft.config.kind, next = ['budget', 'category', 'expense'].includes(kind) ? 'budget' : ['event', 'task'].includes(kind) ? 'timeline' : 'decisions';
          setViewOptions(previous => ({ ...previous, [next]: { ...previous[next], filter: defaultFilter(next), query: '', category: 'all' } }));
          const id = draft.config.ownerId || draft.config.id || 'settings';
          if (next !== view) location.hash = `${next}/${encodeURIComponent(id)}`;
          else setTargetId(id);
        }}>{draft.config.label} · 확인하기</button>;
        })}</div>}
        {error && !modal && !deleteRequest && <p className="simple-error" role="alert">{error} <button type="button" className="text-button" onClick={refresh}>다시 불러오기</button></p>}
        {{ timeline, decisions, budget }[view]()}
        <footer className="simple-footer"><span>우리의 속도로, 하나씩.</span><button type="button" className="text-button" disabled={pending > 0} onClick={refresh}>새로고침</button></footer>
      </main>
      <nav className="simple-mobile-nav" aria-label="모바일 주요 화면">{nav}</nav>
      {message && <div className="simple-toast" role="status">{message}</div>}
      <dialog className="simple-dialog" ref={dialog} aria-labelledby="simple-dialog-title" onCancel={e => { if (modalBusy) e.preventDefault(); else setModal(null); }} onClose={() => { if (!modalBusy) setModal(null); }}>
        {modal && <><div className="simple-dialog-head"><h2 id="simple-dialog-title">{modal.type === 'expense.save' && modal.record.categoryId ? `${state.settings.categories.find(c => c.id === modal.record.categoryId)?.title} 세부항목 추가` : formTitles[modal.type]}</h2><button type="button" className="simple-settings" aria-label="닫기" disabled={modalBusy} onClick={() => setModal(null)}><Icon name="close" /></button></div>
          {modal.type === 'settings' ? <div className="simple-settings-body"><p>{PEOPLE[snapshot.user.role]} 님으로 로그인했어요.</p><div className="simple-actions"><a href="/account" className="secondary-button">비밀번호 변경</a><button type="button" className="primary-button" onClick={logout}>로그아웃</button></div><section className="inline-settings-section"><h3>휴대폰 알림</h3><PushSettings publicKey={snapshot.pushKey} /></section>{state.attachments.length > 0 && <section className="inline-settings-section"><h3>저장된 자료</h3><div className="simple-files">{state.attachments.map(a => <a key={a.id} href={a.url || '/api/attachments/' + a.id} target="_blank" rel="noopener noreferrer">{a.title} ↗</a>)}</div></section>}{error && <p className="simple-error" role="alert">{error}</p>}</div> : modal.type === 'categories' ? <PlanningCategories /> :
            <form className="live-form simple-form" key={modal.type + (modal.record.id || '')} onSubmit={submit}><fieldset disabled={modalBusy}><PlannerFields modal={modal} state={state} /></fieldset>{error && <p className="simple-error" role="alert">{error}</p>}<button type="submit" className="primary-button simple-save" disabled={modalBusy}>{modalBusy ? '저장 중…' : modal.type === 'templates.add' ? '선택·수정 내용 저장' : '추가'}</button></form>}
        </>}
      </dialog>
      <dialog className="simple-dialog" ref={deleteDialog} aria-labelledby="inline-delete-title" onCancel={e => { if (modalBusy) e.preventDefault(); else setDeleteRequest(null); }} onClose={() => { if (!modalBusy) setDeleteRequest(null); }}>
        {deleteRequest && <><h2 id="inline-delete-title">‘{deleteRequest.record.title}’ 항목을 삭제할까요?</h2><p className="inline-delete-description">{branch.length > 1 ? `하위 결정 ${branch.length - 1}개와 후보·참고 자료도 함께 삭제됩니다. ` : '삭제한 항목은 되돌릴 수 없어요. '}{deleteRequest.kind === 'expense' ? '지급 기록을 포함해 예산 합계에서도 제외됩니다.' : ['decision', 'candidate'].includes(deleteRequest.kind) ? '이미 기록한 지출 금액은 유지됩니다.' : ''}</p>{error && <p className="simple-error" role="alert">{error}</p>}<div className="simple-actions"><button type="button" className="secondary-button" disabled={modalBusy} onClick={() => setDeleteRequest(null)}>취소</button><button type="button" className="primary-button simple-delete-button" disabled={modalBusy} onClick={async () => {
          setModalBusy(true); setError('');
          try {
            await queue.command({ type: `${deleteRequest.kind}.delete`, payload: { id: deleteRequest.record.id, ...(deleteRequest.decisionId ? { decisionId: deleteRequest.decisionId } : {}) } });
            setDeleteRequest(null); setMessage('삭제했어요.');
          } catch (e) { setError(e.message); } finally { setModalBusy(false); }
        }}>{modalBusy ? '삭제 중…' : '삭제하기'}</button></div></>}
      </dialog>
    </div>
  </InlineContext.Provider>;
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
