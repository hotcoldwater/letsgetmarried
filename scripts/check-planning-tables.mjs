import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, budgetSummary, initialState } from '../lib/domain.mjs';
import { fieldCommand, visibleDecisions, visibleEvents } from '../lib/inline-planner.mjs';

let serial = 0;
const apply = (state, type, payload) => applyCommand(state, { type, payload }, 'groom', { id: `table-${++serial}`, now: '2026-10-25T12:00:00Z' }).state;

function fixture() {
  let state = initialState();
  state = apply(state, 'event.save', { title: '홀 상담', itemId: 'item-0', date: '2026-11-07', time: '14:00', place: '상담실', memo: '보증 인원 확인', newTasks: '견적서\n계약 조건' });
  state = apply(state, 'event.save', { title: '피팅', itemId: 'item-1', date: '2026-11-14', time: '11:00' });
  state = apply(state, 'event.done', { id: state.events.at(-1).id, done: true });
  state = apply(state, 'event.save', { title: '날짜 미정 상담', itemId: 'item-0' });
  state = apply(state, 'decision.save', { title: '준비', itemId: 'item-0', status: 'doing', memo: '부모 메모' });
  const parent = state.decisions.at(-1).id;
  state = apply(state, 'decision.save', { title: '드레스 선택', parentId: parent, itemId: 'item-1', result: 'A라인', memo: '원단 확인' });
  const child = state.decisions.at(-1).id;
  state = apply(state, 'candidate.save', { decisionId: child, title: '후보 A', quote: 3500000 });
  state = apply(state, 'decision.save', { title: '부케 선택', parentId: parent, itemId: 'item-1', status: 'done' });
  state = apply(state, 'decision.save', { title: '항공권 선택', itemId: 'item-4', status: 'todo' });
  return { state, parent, child };
}

test('custom categories can be added, renamed and reordered without changing linked records', () => {
  let { state } = fixture();
  state = apply(state, 'item.add', { title: '  혼주 준비  ' });
  const id = state.items.at(-1).id;
  state = apply(state, 'event.save', { title: '혼주 피팅', itemId: id });
  state = apply(state, 'decision.save', { title: '혼주 의상', itemId: id });
  const records = structuredClone([state.events, state.decisions]);
  const rename = fieldCommand(state, { kind: 'item', id, field: 'title', required: true, maxLength: 60 }, '양가 부모님', '혼주 준비');
  state = apply(state, rename.type, rename.payload);
  assert.deepEqual([state.events, state.decisions], records);
  assert.equal(visibleEvents(state, '양가 부모님').at(-1).itemId, id);
  assert.equal(visibleDecisions(state, '양가 부모님').at(-1).record.itemId, id);
  state = apply(state, 'item.move', { id, direction: 'up' });
  assert.equal(state.items.at(-2).id, id);
  assert.deepEqual([state.events, state.decisions], records);
  assert.throws(() => apply(state, 'item.add', { title: '양가 부모님' }));
  assert.throws(() => apply(state, 'item.update', { id, title: '예식장' }));
  assert.throws(() => apply(state, 'item.add', { title: 'x'.repeat(61) }));
  assert.throws(() => apply(state, 'item.move', { id, direction: 'sideways' }));
});

test('deleting a category reassigns active and archived records without losing hierarchy, tasks or amounts', () => {
  let { state, parent, child } = fixture();
  const eventId = state.events.find(event => event.itemId === 'item-0').id;
  state = apply(state, 'event.archive', { id: eventId, archived: true });
  state = apply(state, 'decision.archive', { id: parent, archived: true });
  state = apply(state, 'expense.save', { title: '계약', categoryId: 'venue', amount: 3000000, paid: 1000000, status: 'confirmed' });
  const before = structuredClone(state), totals = budgetSummary(state);
  state = apply(state, 'item.delete', { id: 'item-0', replacementId: 'item-1' });
  assert.ok(!state.items.some(item => item.id === 'item-0'));
  assert.deepEqual(state.events, before.events.map(event => ({ ...event, ...(event.itemId === 'item-0' ? { itemId: 'item-1' } : {}) })));
  assert.deepEqual(state.decisions, before.decisions.map(decision => ({ ...decision, ...(decision.itemId === 'item-0' ? { itemId: 'item-1' } : {}) })));
  assert.equal(state.decisions.find(d => d.id === child).parentId, parent);
  assert.deepEqual(budgetSummary(state), totals);
  assert.deepEqual(state.expenses, before.expenses);
  assert.throws(() => fieldCommand(state, { kind: 'item', id: 'item-0', field: 'title' }, '복원', '예식장'));
});

test('deleting to unassigned preserves every record and rejects invalid destinations atomically', () => {
  const { state } = fixture(), original = structuredClone(state);
  for (const replacementId of ['item-0', 'missing']) assert.throws(() => apply(state, 'item.delete', { id: 'item-0', replacementId }));
  assert.deepEqual(state, original);
  const updated = apply(state, 'item.delete', { id: 'item-0', replacementId: '' });
  assert.equal(updated.events.length, state.events.length);
  assert.equal(updated.decisions.length, state.decisions.length);
  assert.ok(updated.events.filter(event => state.events.find(old => old.id === event.id).itemId === 'item-0').every(event => event.itemId === ''));
  assert.ok(visibleEvents(updated, '', 'all', 'unassigned').some(event => event.title === '홀 상담'));
});

test('shared category references are retained and require a destination before category removal', () => {
  let { state } = fixture();
  state = apply(state, 'attachment.add', { kind: 'item', targetId: 'item-0', title: '공통 자료', url: 'https://example.com/venue' });
  state.comments.push({ id: 'legacy-comment', kind: 'item', targetId: 'item-0', body: '보존할 메모' });
  state.notes.push({ id: 'legacy-note', itemId: 'item-0', title: '기존 기록' });
  const before = structuredClone(state);
  assert.throws(() => apply(state, 'item.delete', { id: 'item-0' }), /자료/);
  assert.deepEqual(state, before);
  state = apply(state, 'item.delete', { id: 'item-0', replacementId: 'item-1' });
  assert.deepEqual(state.attachments, before.attachments.map(file => ({ ...file, targetId: 'item-1' })));
  assert.equal(state.comments[0].body, '보존할 메모');
  assert.equal(state.comments[0].targetId, 'item-1');
  assert.equal(state.notes[0].itemId, 'item-1');
});

test('an event category survives unrelated edits and can be deliberately cleared', () => {
  let { state } = fixture();
  const event = state.events.find(event => event.title === '홀 상담');
  const { itemId, ...withoutCategory } = event;
  state = apply(state, 'event.save', { ...withoutCategory, memo: '새 메모' });
  assert.equal(state.events.find(e => e.id === event.id).itemId, itemId);
  const command = fieldCommand(state, { kind: 'event', id: event.id, field: 'itemId' }, '', itemId);
  state = apply(state, command.type, command.payload);
  assert.equal(state.events.find(e => e.id === event.id).itemId, '');
  assert.deepEqual(state.events.find(e => e.id === event.id).tasks, event.tasks);
});

test('schedule filters combine category, status, text and archived visibility', () => {
  let { state } = fixture();
  assert.deepEqual(visibleEvents(state, '견적', 'active', 'item-0').map(event => event.title), ['홀 상담']);
  assert.deepEqual(visibleEvents(state, '', 'done', 'item-1').map(event => event.title), ['피팅']);
  assert.equal(visibleEvents(state, '예식장', 'all', 'item-1').length, 0);
  assert.deepEqual(visibleEvents(state, '', 'all', 'unassigned').map(event => event.id), ['wedding']);
  const event = state.events.find(event => event.title === '홀 상담');
  state = apply(state, 'event.archive', { id: event.id, archived: true });
  assert.equal(visibleEvents(state, '홀 상담').length, 0);
  assert.equal(visibleEvents(state, '', 'archived', 'item-0')[0].id, event.id);
});

test('schedule sorting keeps undated events last and respects custom category order', () => {
  let { state } = fixture();
  const original = structuredClone(state.events);
  assert.equal(visibleEvents(state).at(-1).title, '날짜 미정 상담');
  assert.equal(visibleEvents(state, '', 'all', 'all', { key: 'date', direction: 'desc' }).at(-1).title, '날짜 미정 상담');
  assert.equal(visibleEvents(state, '', 'all', 'all', { key: 'status', direction: 'desc' })[0].title, '피팅');
  state = apply(state, 'item.move', { id: 'item-1', direction: 'up' });
  assert.equal(visibleEvents(state, '', 'all', 'all', { key: 'category', direction: 'asc' })[0].itemId, 'item-1');
  assert.deepEqual(state.events, original);
});

test('filtering decisions by a child category keeps ancestors as context without including unrelated siblings', () => {
  const { state, parent, child } = fixture();
  const rows = visibleDecisions(state, '원단', 'todo', 'item-1');
  assert.deepEqual(rows.map(row => [row.record.id, row.context]), [[parent, true], [child, false]]);
  assert.equal(visibleDecisions(state, '후보 A', 'all', 'item-1').at(-1).record.id, child);
});

test('decision sorting orders siblings while keeping descendants attached to their parent', () => {
  const { state, parent, child } = fixture(), original = structuredClone(state.decisions);
  const rows = visibleDecisions(state, '', 'all', 'all', { key: 'status', direction: 'desc' });
  assert.equal(rows[0].record.id, parent);
  assert.equal(rows[1].record.title, '부케 선택');
  assert.equal(rows[2].record.id, child);
  assert.equal(rows[3].record.title, '항공권 선택');
  assert.deepEqual(rows.map(row => row.depth), [0, 1, 1, 0]);
  assert.deepEqual(state.decisions, original);
});
