'use client';
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { fieldKey, fieldValue, recordAnchor } from '../lib/inline-planner.mjs';
import { decisionPath } from '../lib/domain.mjs';
import { EditableField, useInline } from './inline-fields';
import { Action, DecisionCard, EventCard } from './inline-records';
import { decisionLabels } from './planner-forms';

export function TableCell({ placeholder = '—', ...props }) {
  const { state, saves } = useInline(), [editing, setEditing] = useState(false);
  const config = { kind: props.kind, id: props.record.id, field: props.field };
  const draft = saves.drafts[fieldKey(config)], current = fieldValue(state, config);
  const value = draft && draft.status !== 'saved' ? draft.value : current;
  const text = props.options ? props.options.find(([id]) => id === value)?.[1] || placeholder : String(value ?? '') || placeholder;
  const label = `${props.record.title} · ${props.label}`;
  return <div className={`planner-cell ${editing || draft?.status === 'error' ? 'is-editing' : ''}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setEditing(false);
  }}>
    {editing || draft?.status === 'error' ? <EditableField {...props} label={label} autoFocus={editing} className="planner-cell-editor" /> : <>
      {props.disabled ? <span className="planner-cell-readonly"><span className="planner-cell-text">{text}</span></span> : <button type="button" className={`planner-cell-trigger ${props.field === 'status' ? `planner-status-${value}` : ''}`} aria-label={`${label} 수정 · ${text}`} title={text} onClick={() => setEditing(true)}><span className="planner-cell-text">{text}</span></button>}
      {draft?.status === 'saving' && <span className="planner-cell-saving" role="status">저장 중…</span>}
    </>}
  </div>;
}

const eventColumns = [
  ['title', '일정', 'title'], ['category', '카테고리', 'category'], ['date', '날짜', 'date'], ['time', '시간'], ['place', '장소'], ['done', '완료', 'status'], ['tasks', '준비물'], ['memo', '메모'], ['files', '자료'],
];
const decisionColumns = [
  ['title', '결정할 것', 'title'], ['category', '카테고리', 'category'], ['status', '상태', 'status'], ['result', '정한 내용'], ['candidates', '후보'], ['memo', '메모'], ['files', '자료'],
];

function TableFrame({ kind, columns, sort, onSort, scrollMemory, children }) {
  const scroller = useRef(null);
  useLayoutEffect(() => {
    const position = scrollMemory?.current[kind];
    if (position) { scroller.current.scrollTop = position.top; scroller.current.scrollLeft = position.left; }
  }, [kind, scrollMemory]);
  return <div ref={scroller} className={`planner-table-scroll ${kind}-table`} tabIndex={0} role="region" aria-label={`${kind === 'event' ? '일정' : '결정할 것'} 표 · 좌우로 스크롤할 수 있어요`} onScroll={event => {
    if (scrollMemory) scrollMemory.current[kind] = { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft };
  }}>
    <table className="planner-table">
      <caption className="sr-only">{kind === 'event' ? '일정' : '결정할 것'} 전체 목록. 셀을 눌러 수정하거나 항목 옆 펼치기 버튼으로 상세 내용을 확인하세요.</caption>
      <colgroup>{columns.map(([key]) => <col key={key} className={`planner-col-${key}`} />)}</colgroup>
      <thead><tr>{columns.map(([key, label, sortKey], index) => <th key={key} scope="col" className={index === 0 ? 'planner-sticky-name' : ''} aria-sort={sortKey ? sort.key === sortKey ? sort.direction === 'desc' ? 'descending' : 'ascending' : 'none' : undefined}>
        {sortKey ? <button type="button" onClick={() => onSort({ key: sortKey, direction: sort.key === sortKey && sort.direction === 'asc' ? 'desc' : 'asc' })}>{label}<span aria-hidden="true">{sort.key === sortKey ? sort.direction === 'desc' ? '↓' : '↑' : '↕'}</span></button> : label}
      </th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>;
}

function DetailButton({ record, kind, label, children, expanded, toggle, className = '' }) {
  return <button type="button" className={`planner-detail-button ${className}`} aria-label={`${record.title} · ${label}`} aria-expanded={expanded} aria-controls={`detail-${recordAnchor(kind, record.id)}`} onClick={toggle}><span className="planner-cell-text">{children}</span></button>;
}

function RowTitle({ record, kind, expanded, toggle, depth = 0, context = false, ordering = false }) {
  const { state, queue } = useInline();
  const path = kind === 'decision' ? decisionPath(state, record.id).slice(0, -1).map(p => p.title).join(' / ') : '';
  const parentId = record => state.decisions.some(parent => parent.id === record.parentId) ? record.parentId : '';
  const siblings = ordering ? state.decisions.filter(other => !other.archived && parentId(other) === parentId(record)) : [];
  const index = siblings.findIndex(other => other.id === record.id);
  return <th scope="row" className="planner-sticky-name">
    <div className="planner-row-title" style={{ paddingLeft: Math.min(depth, 4) * 12 }}>
      <button type="button" className="planner-expand" aria-label={`${record.title} 상세 ${expanded ? '접기' : '펼치기'}`} aria-expanded={expanded} aria-controls={`detail-${recordAnchor(kind, record.id)}`} onClick={toggle}>{expanded ? '▾' : '▸'}</button>
      <div className="planner-row-name">{(depth > 0 || context) && <span className="planner-parent-hint" title={path}>{context ? '상위 항목' : `↳ ${depth}단계 하위 항목`}</span>}<TableCell kind={kind} record={record} field="title" label={kind === 'event' ? '일정 이름' : '결정할 것'} required multiline maxLength={200} disabled={record.archived || context} />{record.archived && <span className="planner-parent-hint">보관됨</span>}{ordering && !record.archived && <div className="planner-row-order"><Action aria-label={`${record.title} 위로 이동`} disabled={index <= 0} action={() => queue.command({ type: 'decision.move', payload: { id: record.id, direction: 'up' } })}>↑</Action><Action aria-label={`${record.title} 아래로 이동`} disabled={index === siblings.length - 1} action={() => queue.command({ type: 'decision.move', payload: { id: record.id, direction: 'down' } })}>↓</Action></div>}</div>
    </div>
  </th>;
}

const categoryOptions = state => [['', '미분류'], ...state.items.map(item => [item.id, item.title])];

export function ScheduleTable({ records, sort, onSort, expanded, toggle, scrollMemory }) {
  const { state } = useInline();
  return <TableFrame kind="event" columns={eventColumns} sort={sort} onSort={onSort} scrollMemory={scrollMemory}>
    {records.map(record => {
      const key = recordAnchor('event', record.id), isOpen = !!expanded[key], open = () => toggle(key);
      const props = { kind: 'event', record, disabled: !!record.archived };
      const tasks = (record.tasks || []).filter(task => !task.archived), files = state.attachments.filter(file => (file.kind === 'event' && file.targetId === record.id) || (record.itemId && file.kind === 'item' && file.targetId === record.itemId));
      return <Fragment key={record.id}>
        <tr id={key} tabIndex={-1} className={`${record.done ? 'planner-row-done' : ''} ${isOpen ? 'planner-row-open' : ''}`}>
          <RowTitle record={record} kind="event" expanded={isOpen} toggle={open} />
          <td><TableCell {...props} field="itemId" label="카테고리" options={categoryOptions(state)} /></td>
          <td><TableCell {...props} field="date" label="날짜" type="date" placeholder="날짜 미정" /></td>
          <td><TableCell {...props} field="time" label="시간" type="time" /></td>
          <td><TableCell {...props} field="place" label="장소" multiline maxLength={300} /></td>
          <td className="planner-complete"><EditableField {...props} field="done" label={`${record.title} 완료`} type="checkbox" /></td>
          <td><DetailButton record={record} kind="event" label="준비물 보기" expanded={isOpen} toggle={open}>{tasks.length ? `${tasks.filter(task => task.done).length}/${tasks.length} 완료` : '+ 준비물'}</DetailButton></td>
          <td><DetailButton record={record} kind="event" label="메모 보기" expanded={isOpen} toggle={open} className="planner-memo-preview">{record.memo || '+ 메모'}</DetailButton></td>
          <td><DetailButton record={record} kind="event" label="참고 자료 보기" expanded={isOpen} toggle={open}>{files.length ? `${files.length}개` : '+ 자료'}</DetailButton></td>
        </tr>
        {isOpen && <tr id={`detail-${key}`} className="planner-detail-row"><td colSpan={eventColumns.length}><div className="planner-detail-panel"><div className="planner-detail-heading"><strong>{record.title}</strong><button type="button" className="text-button planner-close-details" onClick={open}>상세 접기</button></div><EventCard record={record} embedded /></div></td></tr>}
      </Fragment>;
    })}
    {!records.length && <tr><td colSpan={eventColumns.length} className="planner-table-empty"><div>조건에 맞는 일정이 없어요. 필터를 바꾸거나 새 일정을 추가해 보세요.</div></td></tr>}
  </TableFrame>;
}

export function DecisionTable({ rows, sort, onSort, expanded, toggle, ordering = false, scrollMemory }) {
  const { state } = useInline();
  return <TableFrame kind="decision" columns={decisionColumns} sort={sort} onSort={onSort} scrollMemory={scrollMemory}>
    {rows.map(({ record, depth, context }) => {
      const key = recordAnchor('decision', record.id), isOpen = !!expanded[key], open = () => toggle(key);
      const props = { kind: 'decision', record, disabled: !!record.archived || context };
      const candidates = record.options.filter(option => !option.archived), files = state.attachments.filter(file => (file.kind === 'decision' && file.targetId === record.id) || (record.itemId && file.kind === 'item' && file.targetId === record.itemId) || (file.kind === 'candidate' && candidates.some(option => option.id === file.targetId)));
      return <Fragment key={record.id}>
        <tr id={key} tabIndex={-1} className={`${context ? 'planner-row-context' : ''} ${record.status === 'done' ? 'planner-row-done' : ''} ${isOpen ? 'planner-row-open' : ''}`}>
          <RowTitle record={record} kind="decision" expanded={isOpen} toggle={open} depth={depth} context={context} ordering={ordering} />
          <td><TableCell {...props} field="itemId" label="카테고리" options={categoryOptions(state)} /></td>
          <td><TableCell {...props} field="status" label="상태" options={Object.entries(decisionLabels)} /></td>
          <td><TableCell {...props} field="result" label="정한 내용" multiline maxLength={2000} /></td>
          <td><DetailButton record={record} kind="decision" label="후보 비교 보기" expanded={isOpen} toggle={open}>{candidates.length ? `${candidates.length}개` : '+ 후보'}</DetailButton></td>
          <td><DetailButton record={record} kind="decision" label="메모 보기" expanded={isOpen} toggle={open} className="planner-memo-preview">{record.memo || '+ 메모'}</DetailButton></td>
          <td><DetailButton record={record} kind="decision" label="참고 자료 보기" expanded={isOpen} toggle={open}>{files.length ? `${files.length}개` : '+ 자료'}</DetailButton></td>
        </tr>
        {isOpen && <tr id={`detail-${key}`} className="planner-detail-row"><td colSpan={decisionColumns.length}><div className="planner-detail-panel"><div className="planner-detail-heading"><strong>{record.title}</strong><button type="button" className="text-button planner-close-details" onClick={open}>상세 접기</button></div><DecisionCard record={record} depth={depth} context={context} embedded /></div></td></tr>}
      </Fragment>;
    })}
    {!rows.length && <tr><td colSpan={decisionColumns.length} className="planner-table-empty"><div>조건에 맞는 결정이 없어요. 필터를 바꾸거나 새 항목을 추가해 보세요.</div></td></tr>}
  </TableFrame>;
}

export function PlanningFilters({ view, options, change, count, total }) {
  const { state, open } = useInline();
  const statuses = view === 'timeline' ? [['all', '전체 상태'], ['active', '남은 일정'], ['done', '완료'], ['archived', '보관함']] : [['all', '전체 상태'], ['active', '남은 결정'], ['todo', '미정'], ['doing', '진행 중'], ['done', '완료'], ['archived', '보관함']];
  const sorts = view === 'timeline' ? [['date', '날짜순'], ['category', '카테고리순'], ['status', '완료순'], ['title', '이름순']] : [['manual', '직접 정한 순서'], ['category', '카테고리순'], ['status', '상태순'], ['title', '이름순']];
  const filtering = options.query || options.category !== 'all' || options.filter !== 'all';
  return <div className="planner-filters">
    <div className="planner-category-bar"><div className="planner-category-chips" role="group" aria-label="카테고리 필터">
      {[['all', '전체'], ...state.items.map(item => [item.id, item.title]), ['unassigned', '미분류']].map(([id, title]) => <button type="button" key={id} aria-pressed={options.category === id} onClick={() => change({ category: id })}>{title}</button>)}
    </div><button type="button" className="text-button" onClick={() => open('categories')}>카테고리 관리</button></div>
    <div className="planner-table-tools">
      <label className="planner-table-search"><span className="sr-only">카테고리·제목·내용 검색</span><input type="search" value={options.query} onChange={event => change({ query: event.target.value })} placeholder="카테고리·제목·내용 검색" /></label>
      <label><span className="sr-only">상태 필터</span><select value={options.filter} onChange={event => change({ filter: event.target.value })}>{statuses.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      <label><span className="sr-only">정렬 기준</span><select value={options.sort.key} onChange={event => change({ sort: { key: event.target.value, direction: 'asc' } })}>{sorts.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      {options.sort.key !== 'manual' && <button type="button" className="planner-sort-direction" aria-label={options.sort.direction === 'asc' ? '내림차순으로 변경' : '오름차순으로 변경'} onClick={() => change({ sort: { ...options.sort, direction: options.sort.direction === 'asc' ? 'desc' : 'asc' } })}>{options.sort.direction === 'asc' ? '↑' : '↓'}</button>}
      {filtering && <button type="button" className="text-button" onClick={() => change({ query: '', filter: 'all', category: 'all' })}>필터 초기화</button>}
    </div>
    <div className="planner-table-help"><span>{count}개 표시 · 전체 {total}개{options.filter === 'archived' && ' (보관함)'}</span><span>셀을 눌러 수정 · ▸ 상세 펼치기{view === 'decisions' && ' · 하위 항목은 상위 아래에 표시'}</span></div>
  </div>;
}
