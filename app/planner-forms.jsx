import { useState } from 'react';
import { checklistTemplates } from '../lib/planning-templates.mjs';
import { expenseStatus, decisionBranch, decisionPath, preparationTemplates, eventDetailsCount } from '../lib/domain.mjs';
export const decisionLabels = { todo: '미정', doing: '진행 중', done: '완료' };
export const expenseLabels = { estimated: '예상', confirmed: '확정', paid: '지급 완료' };
export function Field({ label, name, value = '', type = 'text', ...props }) {
  return <label>{label}<input name={name} type={type} defaultValue={value} {...props} /></label>;
}
const Memo = ({ label, name, value = '', maxLength = 5000, ...props }) => <label>{label}<textarea name={name} defaultValue={value} maxLength={maxLength} rows={3} {...props} /></label>;
function EventFields({ record: r }) {
  const [memo, setMemo] = useState(r.memo || ''), [newTasks, setNewTasks] = useState('');
  const count = eventDetailsCount(memo, r.tasks, newTasks);
  return <>
    <Field label="일정 이름" name="title" value={r.title} required maxLength={200} autoFocus placeholder="예: 드레스 피팅" />
    <div className="simple-fields"><Field label="날짜" name="date" type="date" value={r.date} /><Field label="시간" name="time" type="time" value={r.time} /></div>
    <Field label="장소" name="place" value={r.place} maxLength={300} placeholder="장소는 나중에 정해도 돼요" />
    <details className="simple-more" open><summary>메모와 준비물{count ? ` (${count})` : ''}</summary>
      <Memo label="챙길 것" name="memo" value={r.memo} onChange={e => setMemo(e.target.value)} />
      {r.tasks?.filter(t => !t.archived).map(t => <label className="simple-check" key={t.id}><input name={'task-' + t.id} type="checkbox" defaultChecked={t.done} />{t.title}</label>)}
      <label>체크리스트 불러오기<select name="checklistId" defaultValue=""><option value="">선택하지 않음</option>{checklistTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <Memo label="준비물 추가 · 한 줄에 하나씩" name="newTasks" onChange={e => setNewTasks(e.target.value)} />
    </details>
  </>;
}
function TemplateFields({ state }) {
  const [editing, setEditing] = useState(false);
  const [templates, setTemplates] = useState(() => preparationTemplates(state));
  const update = (id, key, value) => setTemplates(previous => previous.map(t => t.id === id ? { ...t, [key]: value } : t));
  return <>
    <div className="simple-template-heading"><p className="simple-help">필요한 항목을 골라 추가해요. 목록 이름과 분류를 수정하면 다음에도 유지돼요.</p><button type="button" className="text-button" aria-pressed={editing} onClick={() => setEditing(value => !value)}>{editing ? '선택 목록 보기' : '목록 이름·분류 수정'}</button></div>
    {editing && <p className="simple-help">이미 추가한 결정은 그대로 유지돼요. 변경한 목록은 아래 저장 버튼으로 저장해 주세요.</p>}
    <div className="simple-template-list">{templates.map(t => {
      const added = state.decisions.some(d => d.templateId === t.id);
      return <div className="simple-template-item" key={t.id}>
        <label className="simple-check"><input type="checkbox" name="templates" value={t.id} disabled={added} /><span>{t.title}<small>{added ? '이미 추가됨' : t.group}</small></span></label>
        {editing ? <div className="simple-template-edit">
          <label>항목 이름<input name={'template-title-' + t.id} value={t.title} onChange={e => update(t.id, 'title', e.target.value)} required maxLength={200} /></label>
          <label>분류<input name={'template-group-' + t.id} value={t.group} onChange={e => update(t.id, 'group', e.target.value)} required maxLength={60} /></label>
        </div> : <><input type="hidden" name={'template-title-' + t.id} value={t.title} /><input type="hidden" name={'template-group-' + t.id} value={t.group} /></>}
      </div>;
    })}</div>
  </>;
}
export default function PlannerFields({ modal, state }) {
  const r = modal.record || {};
  const groups = <><option value="">분류 없음</option>{state.items.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</>;
  if (modal.type === 'event.save') return <EventFields record={r} />;
  if (modal.type === 'decision.save') return <>
    <Field label="결정할 것" name="title" value={r.title} required maxLength={200} autoFocus placeholder="예: 스튜디오 업체 정하기" />
    <label>상위 결정<select name="parentId" defaultValue={r.parentId || ''}><option value="">없음 · 최상위 결정</option>{state.decisions.filter(d => (!d.archived || d.id === r.parentId) && !decisionBranch(state, r.id).some(child => child.id === d.id)).map(d => <option key={d.id} value={d.id}>{decisionPath(state, d.id).map(p => p.title).join(' / ')}</option>)}</select></label>
    <div className="simple-fields"><label>상태<select name="status" defaultValue={r.status || 'todo'}>{Object.entries(decisionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>분류<select name="itemId" defaultValue={r.itemId || ''}>{groups}</select></label></div>
    <Memo label="정한 내용" name="result" value={r.result} maxLength={2000} />
    <details className="simple-more" open><summary>참고 메모</summary><Memo label="확인할 내용" name="memo" value={r.memo} /></details>
  </>;
  if (modal.type === 'expense.save') return <>
    <Field label="지출 이름" name="title" value={r.title} required maxLength={200} autoFocus placeholder="예: 예식장 계약" />
    <div className="simple-fields"><label>상태<select name="status" defaultValue={expenseStatus(r)}>{Object.entries(expenseLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>분류<select name="categoryId" defaultValue={r.categoryId || state.settings.categories[0].id}>{state.settings.categories.map(c => <option key={c.id} value={c.id}>{c.title}{c.included ? '' : ' · 예산 제외'}</option>)}</select></label></div>
    <div className="simple-fields"><Field label="총금액 (원)" name="amount" type="number" value={r.amount ?? ''} required min="0" max="10000000000" step="1" /><Field label="이미 지급한 금액 (원)" name="paid" type="number" value={r.paid ?? 0} required min="0" max="10000000000" step="1" /></div>
    <p className="simple-help">총금액은 계약금과 잔금을 합친 금액이에요. ‘지급 완료’로 저장하면 전액 지급한 것으로 반영해요.</p>
    <Field label="남은 금액 결제 예정일 · 선택" name="dueDate" type="date" value={r.dueDate} />
    <details className="simple-more" open><summary>계약 내용과 연결된 결정</summary><Memo label="포함 항목 · 추가금 등" name="detail" value={r.detail} maxLength={2000} /><label>연결할 결정<select name="decisionId" defaultValue={r.source?.decisionId || ''}><option value="">연결하지 않음</option>{state.decisions.filter(d => (!d.archived && d.status === 'done') || d.id === r.source?.decisionId).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label></details>
  </>;
  if (modal.type === 'budget.save') return <>
    <Field label="목표 예산 (원)" name="budget" type="number" value={state.settings.budget} min="0" max="10000000000" step="1" required autoFocus />
    <Field label="예산에 포함할 범위" name="scope" value={state.settings.scope} required maxLength={200} />
    <details className="simple-more" open><summary>분류와 예산 포함 여부</summary>{state.settings.categories.map(c => <div className="simple-category-edit" key={c.id}><Field label="분류 이름" name={'category-' + c.id} value={c.title} required maxLength={60} /><label className="simple-check"><input type="checkbox" name={'included-' + c.id} defaultChecked={c.included} />예산에 포함</label></div>)}<Field label="새 분류 · 선택" name="newCategory" maxLength={60} /><label className="simple-check"><input type="checkbox" name="newIncluded" defaultChecked />새 분류를 예산에 포함</label></details>
  </>;
  if (modal.type === 'templates.add') return <TemplateFields state={state} />;
  if (modal.type === 'candidate.save') return <>
    <Field label="후보 이름" name="title" value={r.title} required maxLength={200} autoFocus /><Field label="견적 (원) · 선택" name="quote" type="number" value={r.quote ?? ''} min="0" max="10000000000" step="1" /><Memo label="확인할 조건" name="detail" value={r.detail} /><Field label="참고 링크 · 선택" name="link" type="url" value={r.link} maxLength={2000} /><p className="simple-help">후보 견적은 예산에 자동 합산되지 않아요.</p>
  </>;
  if (modal.type === 'attachment.add') return <><Field label="자료 이름" name="title" required maxLength={200} autoFocus /><Field label="링크 주소" name="url" type="url" required maxLength={2000} /></>;
  if (modal.type === 'upload') return <><Field label="사진 또는 PDF" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /><p className="simple-help">사진은 크기를 줄여 저장해요. 최종 파일은 4MB 이하로 첨부할 수 있어요.</p></>;
}
