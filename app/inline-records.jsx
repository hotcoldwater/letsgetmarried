'use client';
import { useState } from 'react';
import { decisionBranch, decisionPath, expenseStatus } from '../lib/domain.mjs';
import { checklistTemplates } from '../lib/planning-templates.mjs';
import { recordAnchor } from '../lib/inline-planner.mjs';
import { decisionLabels, expenseLabels } from './planner-forms';
import { EditableField as Field, OptionalField, QuickAdd, useInline } from './inline-fields';

export const won = value => Number(value || 0).toLocaleString('ko-KR') + '원';

export function Action({ children, action, className = 'text-button', disabled = false, ...props }) {
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  return <span className="inline-action"><button type="button" {...props} className={className} disabled={disabled || pending} onClick={async () => {
    setPending(true); setError('');
    try { await action(); } catch (e) { setError(e.message); } finally { setPending(false); }
  }}>{pending ? '저장 중…' : children}</button>{error && <span className="inline-field-error" role="alert">{error}</span>}</span>;
}

export function RecordActions({ kind, record, ownerId }) {
  const { queue, remove } = useInline();
  const canArchive = ['event', 'decision', 'expense'].includes(kind) && record.id !== 'wedding' && (kind !== 'expense' || !record.paid || record.archived);
  return <div className="inline-record-actions">
    {canArchive && <Action action={() => queue.command({ type: `${kind}.archive`, payload: { id: record.id, archived: !record.archived } })}>{record.archived ? '보관함에서 복원' : '보관'}</Action>}
    <button type="button" className="text-button simple-delete" onClick={() => remove({ kind, record, decisionId: ownerId })}>삭제</button>
  </div>;
}

export function Attachments({ kind, record, disabled = false, children }) {
  const { state, open, storageEnabled, remove } = useInline();
  const files = state.attachments.filter(a => a.kind === kind && a.targetId === record.id);
  return <section className={`inline-attachments ${files.length ? 'has-files' : ''}`} aria-label={`${record.title} 참고 자료`}>
    {files.length > 0 && <><h3>참고 자료 <span>{files.length}</span></h3><div className="inline-file-list">{files.map(a => <div className="inline-file" key={a.id}>
      <a href={a.url || `/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer">
        {a.type?.startsWith('image/') && <img src={`/api/attachments/${a.id}`} loading="lazy" alt={a.title} />}
        <span>{a.title} <span aria-hidden="true">↗</span></span>
      </a>
      <button type="button" className="text-button simple-delete" aria-label={`${a.title} 자료 삭제`} onClick={() => remove({ kind: 'attachment', record: a })}>삭제</button>
    </div>)}</div></>}
    <div className="inline-attachment-actions">{children}<button type="button" className="text-button" disabled={disabled} onClick={() => open('attachment.add', record, { kind })}>+ 참고 링크</button>{storageEnabled && <button type="button" className="text-button" disabled={disabled} onClick={() => open('upload', record, { kind })}>+ 사진 · PDF</button>}</div>
  </section>;
}

function Candidate({ record, decision }) {
  const { queue } = useInline();
  const selected = decision.selectedId === record.id, disabled = decision.archived || record.archived;
  const props = { kind: 'candidate', record, ownerId: decision.id, disabled };
  return <article className={`inline-candidate ${selected ? 'selected' : ''}`} aria-label={`후보 ${record.title}`}>
    <div className="inline-candidate-heading"><span>{selected ? '✓ 선택한 후보' : record.archived ? '보관한 후보' : '비교 후보'}</span>{!disabled && <Action action={() => queue.command({ type: 'decision.select', payload: { id: decision.id, optionId: record.id } })} disabled={selected}>{selected ? '결정 완료' : '이 후보로 결정'}</Action>}</div>
    <div className="inline-grid"><Field {...props} field="title" label="후보 이름" required maxLength={200} multiline /><Field {...props} field="quote" label="견적 (원)" type="number" optional min="0" max="10000000000" step="1" /></div>
    <OptionalField {...props} field="detail" label="조건 · 확인할 내용" multiline maxLength={5000} />
    <OptionalField {...props} field="link" label="참고 링크 주소" type="url" maxLength={2000} />
    {record.link && <a className="inline-external" href={record.link} target="_blank" rel="noopener noreferrer">후보 링크 열기 ↗</a>}
    <Attachments kind="candidate" record={record} disabled={disabled} /><RecordActions kind="candidate" record={record} ownerId={decision.id} />
  </article>;
}

export function DecisionCard({ record: d, depth, context, ordering }) {
  const { state, queue } = useInline();
  const [addingCandidate, setAddingCandidate] = useState(false);
  const path = decisionPath(state, d.id), descendants = new Set(decisionBranch(state, d.id).map(child => child.id));
  const siblings = state.decisions.filter(other => !other.archived && (state.decisions.some(p => p.id === other.parentId) ? other.parentId : '') === (state.decisions.some(p => p.id === d.parentId) ? d.parentId : ''));
  const index = siblings.findIndex(other => other.id === d.id);
  const children = state.decisions.filter(child => !child.archived && child.parentId === d.id);
  const props = { kind: 'decision', record: d, disabled: !!d.archived };
  if (context) return <article id={recordAnchor('decision', d.id)} tabIndex={-1} className={`inline-context-card depth-${Math.min(depth, 2)}`} aria-label={`${d.title} 상위 항목`}>
    <span>상위 항목{d.archived && ' · 보관됨'}</span><strong>{d.title}</strong><small>{decisionLabels[d.status]}</small>
    {d.archived && <Action action={() => queue.command({ type: 'decision.archive', payload: { id: d.id, archived: false } })}>복원</Action>}
  </article>;
  return <article id={recordAnchor('decision', d.id)} tabIndex={-1} className={`inline-card inline-decision depth-${Math.min(depth, 2)} ${d.status === 'done' ? 'record-done' : ''} ${context ? 'context-record' : ''}`} aria-label={d.title}>
    <div className="inline-card-kicker"><span>{depth ? path.slice(0, -1).map(parent => parent.title).join(' / ') : state.items.find(i => i.id === d.itemId)?.title || '결정할 것'}{d.archived && ' · 보관됨'}</span>{context && <span>상위 항목</span>}{children.length > 0 && <span>하위 {children.length}개 · 완료 {children.filter(c => c.status === 'done').length}개</span>}</div>
    <div className="inline-card-heading"><Field {...props} field="title" label="결정할 것" required maxLength={200} multiline className="inline-title" /><Field {...props} field="status" label="상태" options={Object.entries(decisionLabels)} className={`inline-status ${d.status}`} /></div>
    <div className="inline-grid inline-notes"><OptionalField {...props} field="result" label="정한 내용" multiline maxLength={2000} /><OptionalField {...props} field="memo" label="참고 메모" multiline maxLength={5000} /></div>
    <div className="inline-grid inline-associations">
      <OptionalField {...props} field="parentId" label="상위 결정" options={[['', '없음 · 최상위 결정'], ...state.decisions.filter(p => !descendants.has(p.id) && (!p.archived || p.id === d.parentId)).map(p => [p.id, decisionPath(state, p.id).map(v => v.title).join(' / ')])]} />
      <OptionalField {...props} field="itemId" label="분류" options={[['', '분류 없음'], ...state.items.map(item => [item.id, item.title])]} />
    </div>
    {(d.options?.length > 0 || addingCandidate) && <section className="inline-candidates"><div className="inline-section-heading"><h3>후보 비교</h3><span>견적은 예산에 자동 합산되지 않아요</span></div><div className="inline-candidate-grid">{d.options?.map(option => <Candidate key={option.id} record={option} decision={d} />)}</div></section>}
    {addingCandidate && <QuickAdd label={`${d.title} 후보 추가`} placeholder="후보 이름을 입력하세요" compact disabled={d.archived} create={title => queue.command({ type: 'candidate.save', payload: { decisionId: d.id, title, quote: null } })} />}
    <Attachments kind="decision" record={d} disabled={d.archived}>{!addingCandidate && <button type="button" className="text-button" disabled={d.archived} onClick={() => setAddingCandidate(true)}>+ 비교할 후보</button>}</Attachments>
    {d.itemId && state.attachments.some(a => a.kind === 'item' && a.targetId === d.itemId) && <Attachments kind="item" record={state.items.find(i => i.id === d.itemId)} />}
    {!d.archived && <QuickAdd label={`${d.title} 하위 결정 추가`} placeholder="이 항목 아래에 정할 것을 추가해요" compact create={title => queue.command({ type: 'decision.save', payload: { title, parentId: d.id, status: 'todo' } })} />}
    <div className="inline-card-footer">{ordering && !d.archived && <div className="inline-order"><Action aria-label={`${d.title} 위로 이동`} disabled={index <= 0} action={() => queue.command({ type: 'decision.move', payload: { id: d.id, direction: 'up' } })}>↑ 위로</Action><Action aria-label={`${d.title} 아래로 이동`} disabled={index === siblings.length - 1} action={() => queue.command({ type: 'decision.move', payload: { id: d.id, direction: 'down' } })}>↓ 아래로</Action></div>}<RecordActions kind="decision" record={d} /></div>
  </article>;
}

export function EventCard({ record: e }) {
  const { queue } = useInline(), [importing, setImporting] = useState(false), [error, setError] = useState('');
  const tasks = (e.tasks || []).filter(t => !t.archived), props = { kind: 'event', record: e, disabled: !!e.archived };
  return <article id={recordAnchor('event', e.id)} tabIndex={-1} className={`inline-card ${e.done ? 'record-done' : ''}`} aria-label={e.title}>
    <div className="inline-card-kicker"><span>{e.date ? `${e.date.replaceAll('-', '.')} · ${new Intl.DateTimeFormat('ko-KR', { weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date(e.date + 'T12:00:00+09:00'))}` : '날짜 미정'}{e.archived && ' · 보관됨'}</span><Field {...props} field="done" label="일정 완료" type="checkbox" /></div>
    <Field {...props} field="title" label="일정 이름" required maxLength={200} multiline className="inline-title" />
    <div className="inline-event-meta"><Field {...props} field="date" label="날짜" type="date" /><Field {...props} field="time" label="시간" type="time" /><Field {...props} field="place" label="장소" multiline maxLength={300} placeholder="아직 정하지 않았어요" /></div>
    <OptionalField {...props} field="memo" label="메모 · 챙길 것" multiline maxLength={5000} />
    <section className="inline-tasks"><div className="inline-section-heading"><h3>준비물</h3><span>{tasks.length ? `${tasks.filter(t => t.done).length} / ${tasks.length}개 완료` : '필요한 것을 적어두세요'}</span></div>
      <div className="inline-task-list">{tasks.map(task => <div className={`inline-task ${task.done ? 'task-done' : ''}`} key={task.id}>
        <Field kind="task" record={task} ownerId={e.id} field="done" label={`${task.title} 완료`} type="checkbox" disabled={e.archived} className="inline-task-check" />
        <Field kind="task" record={task} ownerId={e.id} field="title" label="준비물 이름" multiline required maxLength={200} disabled={e.archived} className="inline-task-title" />
        <Action aria-label={`${task.title} 준비물 제거`} disabled={e.archived} action={() => queue.command(state => {
          const current = state.events.find(event => event.id === e.id)?.tasks.find(t => t.id === task.id);
          if (!current) throw new Error('준비물을 찾지 못했어요.');
          return { type: 'task.update', payload: { ...current, eventId: e.id, archived: true } };
        })}>×</Action>
      </div>)}</div>
      <QuickAdd label={`${e.title} 준비물 추가`} placeholder="준비물을 한 줄로 추가해요" compact disabled={e.archived} create={title => queue.command({ type: 'task.add', payload: { eventId: e.id, title } })} />
      <label className="inline-import">기본 준비물 불러오기<select value="" disabled={importing || e.archived} onChange={async event => {
        const checklistId = event.target.value; if (!checklistId) return;
        setImporting(true); setError('');
        try { await queue.command(state => ({ type: 'event.save', payload: { ...state.events.find(r => r.id === e.id), checklistId } })); }
        catch (err) { setError(err.message); } finally { setImporting(false); }
      }}><option value="">{importing ? '추가 중…' : '체크리스트 선택'}</option>{checklistTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      {error && <p className="inline-field-error" role="alert">{error}</p>}
    </section>
    <Attachments kind="event" record={e} disabled={e.archived} /><RecordActions kind="event" record={e} />
  </article>;
}

export function ExpenseCard({ record: e }) {
  const { state } = useInline(), props = { kind: 'expense', record: e, disabled: !!e.archived };
  return <article id={recordAnchor('expense', e.id)} tabIndex={-1} className="inline-card inline-expense" aria-label={e.title}>
    <div className="inline-card-kicker"><span>{state.settings.categories.find(c => c.id === e.categoryId)?.title}{e.archived && ' · 보관됨'}</span><strong>남은 금액 {won(e.amount - e.paid)}</strong></div>
    <div className="inline-card-heading"><Field {...props} field="title" label="지출 이름" required maxLength={200} multiline className="inline-title" /><Field {...props} field="status" label="지출 상태" options={Object.entries(expenseLabels)} className={`inline-status ${expenseStatus(e)}`} /></div>
    <div className="inline-grid inline-money"><Field {...props} field="amount" label="총금액 (원)" type="number" required min="0" max="10000000000" step="1" /><Field {...props} field="paid" label="이미 지급한 금액 (원)" type="number" required min="0" max="10000000000" step="1" /></div>
    <div className="inline-grid"><Field {...props} field="categoryId" label="분류" options={state.settings.categories.map(c => [c.id, c.title + (c.included ? '' : ' · 예산 제외')])} /><Field {...props} field="dueDate" label="남은 금액 결제 예정일" type="date" /></div>
    <p className="inline-hint">총금액에는 계약금과 잔금이 포함돼요. ‘지급 완료’는 전액 지급으로 반영해요.</p>
    <div className="inline-grid"><OptionalField {...props} field="detail" label="계약 내용 · 추가금" multiline maxLength={2000} /><OptionalField {...props} field="decisionId" label="연결된 결정" options={[['', '연결하지 않음'], ...state.decisions.filter(d => (!d.archived && d.status === 'done') || d.id === e.source?.decisionId).map(d => [d.id, decisionPath(state, d.id).map(p => p.title).join(' / ')])]} /></div>
    <Attachments kind="expense" record={e} disabled={e.archived} /><RecordActions kind="expense" record={e} />
  </article>;
}

export function BudgetCategories({ summary }) {
  const { queue } = useInline(), [adding, setAdding] = useState(false);
  return <section className="inline-categories" aria-label="분류별 예산">
    <div className="inline-section-heading"><h2>분류별 합계</h2><button type="button" className="text-button" onClick={() => setAdding(v => !v)}>{adding ? '추가 닫기' : '+ 분류 추가'}</button></div>
    {adding && <QuickAdd label="새 예산 분류" placeholder="분류 이름" maxLength={60} create={title => queue.command(state => ({ type: 'budget.save', payload: { ...state.settings, categories: [...state.settings.categories, { title, included: true }] } }))} />}
    <div className="inline-category-grid">{summary.rows.map(c => <article id={recordAnchor('category', c.id)} tabIndex={-1} className={`inline-category ${c.included ? '' : 'excluded'}`} key={c.id}>
      <Field kind="category" record={c} field="title" label="분류 이름" multiline required maxLength={60} />
      <strong>{won(c.total)}</strong><div className="inline-category-values"><span>지급 {won(c.paid)}</span><span>잔액 {won(c.committed + c.estimated)}</span></div>
      <Field kind="category" record={c} field="included" label="전체 예산에 포함" type="checkbox" />
    </article>)}</div>
  </section>;
}
