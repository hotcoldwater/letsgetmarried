'use client';
import { useState } from 'react';
import { EditableField, QuickAdd, useInline } from './inline-fields';
import { Action } from './inline-records';
import { recordAnchor } from '../lib/inline-planner.mjs';

export default function PlanningCategories() {
  const { state, queue, saves } = useInline();
  const [removing, setRemoving] = useState(''), [replacement, setReplacement] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  return <div className="planning-category-manager">
    <p className="simple-help">일정과 결정할 것에서 함께 사용하는 카테고리예요. 이름과 순서를 바꾸면 두 탭에 함께 반영돼요.</p>
    <QuickAdd label="새 카테고리 이름" placeholder="예: 혼주 준비, 신혼집" maxLength={60} create={title => queue.command({ type: 'item.add', payload: { title } })} />
    {message && <p className="planning-category-message" role="status">{message}</p>}
    <ul className="planning-category-list">{state.items.map((item, index) => {
      const events = state.events.filter(record => record.itemId === item.id).length, decisions = state.decisions.filter(record => record.itemId === item.id).length;
      const hasSharedFiles = [...state.attachments, ...state.comments].some(record => record.kind === 'item' && record.targetId === item.id);
      return <li key={item.id} id={recordAnchor('item', item.id)} tabIndex={-1}>
        <EditableField kind="item" record={item} field="title" label="카테고리 이름" required maxLength={60} />
        <div className="planning-category-actions"><span>일정 {events}개 · 결정 {decisions}개</span><div>
          <Action aria-label={`${item.title} 카테고리 위로 이동`} disabled={pending || index === 0} action={() => queue.command({ type: 'item.move', payload: { id: item.id, direction: 'up' } })}>↑</Action>
          <Action aria-label={`${item.title} 카테고리 아래로 이동`} disabled={pending || index === state.items.length - 1} action={() => queue.command({ type: 'item.move', payload: { id: item.id, direction: 'down' } })}>↓</Action>
          <button type="button" className="text-button simple-delete" disabled={pending} aria-label={`${item.title} 카테고리 삭제`} onClick={() => { setRemoving(item.id); setReplacement(''); setError(''); setMessage(''); }}>삭제</button>
        </div></div>
        {removing === item.id && <form className="planning-category-remove" onSubmit={async event => {
          event.preventDefault(); if (pending) return;
          setPending(true); setError('');
          try {
            if (!await saves.flush()) throw new Error('저장하지 못한 입력을 먼저 확인해 주세요.');
            const title = state.items.find(category => category.id === replacement)?.title || '미분류';
            await queue.command({ type: 'item.delete', payload: { id: item.id, replacementId: replacement } });
            setRemoving(''); setMessage(`카테고리를 삭제하고 연결된 기록을 ‘${title}’로 옮겼어요.`);
          } catch (e) { setError(e.message); } finally { setPending(false); }
        }}>
          <p>카테고리만 삭제하고 일정 {events}개와 결정 {decisions}개는 아래로 옮겨요. 보관한 기록도 함께 유지돼요.</p>
          {hasSharedFiles && <p>공통 자료도 함께 옮길 수 있도록 다른 카테고리를 선택해 주세요.</p>}
          <label>기록을 옮길 곳<select value={replacement} onChange={event => setReplacement(event.target.value)} required={hasSharedFiles} disabled={pending}><option value="">{hasSharedFiles ? '카테고리 선택' : '미분류'}</option>{state.items.filter(other => other.id !== item.id).map(other => <option key={other.id} value={other.id}>{other.title}</option>)}</select></label>
          {error && <p className="simple-error" role="alert">{error}</p>}
          <div><button type="button" className="text-button" disabled={pending} onClick={() => setRemoving('')}>취소</button><button type="submit" className="primary-button" disabled={pending}>{pending ? '옮기는 중…' : '기록을 옮기고 카테고리 삭제'}</button></div>
        </form>}
      </li>;
    })}</ul>
    {!state.items.length && <p className="simple-help">카테고리를 만들어 일정을 분류해 보세요. 기존 기록은 미분류에서 확인할 수 있어요.</p>}
  </div>;
}
