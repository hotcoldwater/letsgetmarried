import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, budgetSummary, initialState } from '../lib/domain.mjs';
import { createWorkspaceQueue, fieldCommand, fieldValue, parseField, visibleDecisions, visibleExpenseGroups } from '../lib/inline-planner.mjs';
import { formatMoneyEdit, formatMoneyInput, parseMoneyInput } from '../lib/money-input.mjs';

let serial = 0;
const apply = (state, command) => applyCommand(state, command, 'groom', { id: `test-${++serial}`, now: '2026-10-20T12:00:00.000Z' }).state;
function fixture() {
  let state = initialState();
  state = apply(state, { type: 'decision.save', payload: { title: '스드메', memo: '부모 메모' } });
  const parent = state.decisions.at(-1).id;
  state = apply(state, { type: 'decision.save', payload: { title: '드레스', parentId: parent, result: 'A라인' } });
  const child = state.decisions.at(-1).id;
  state = apply(state, { type: 'decision.save', payload: { title: '피팅', parentId: child, memo: '운동화 준비' } });
  const leaf = state.decisions.at(-1).id;
  state = apply(state, { type: 'decision.save', payload: { title: '반지' } });
  return { state, parent, child, leaf };
}
function server(initial) {
  let remote = { state: initial, version: 1 }, local = structuredClone(remote), active = 0, maximum = 0;
  const versions = [], counts = [];
  const queue = createWorkspaceQueue({
    getSnapshot: () => local,
    receive: snapshot => { local = structuredClone(snapshot); },
    reload: async () => structuredClone(remote),
    pendingChanged: count => counts.push(count),
    post: async (command, version) => {
      active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
      if (version !== remote.version) { const e = new Error('conflict'); e.status = 409; throw e; }
      versions.push(version);
      remote = { state: apply(remote.state, command), version: remote.version + 1 };
      return structuredClone(remote);
    },
  });
  return { queue, versions, counts, get local() { return local; }, get remote() { return remote; }, get maximum() { return maximum; }, change(command) { remote = { state: apply(remote.state, command), version: remote.version + 1 }; } };
}

test('all descendants are visible in parent-first order without opening a parent', () => {
  const { state, parent, child, leaf } = fixture();
  const rows = visibleDecisions(state);
  assert.deepEqual(rows.slice(0, 3).map(r => [r.record.id, r.depth]), [[parent, 0], [child, 1], [leaf, 2]]);
  assert.equal(rows.length, state.decisions.length);
});
test('searching a child memo retains the full ancestor path', () => {
  const { state, parent, child, leaf } = fixture();
  assert.deepEqual(visibleDecisions(state, '운동화').map(r => [r.record.id, r.context]), [[parent, true], [child, true], [leaf, false]]);
});
test('status filtering keeps context even when a parent has another status', () => {
  const { state, leaf } = fixture();
  const changed = apply(state, { type: 'decision.status', payload: { id: leaf, status: 'done' } });
  assert.equal(visibleDecisions(changed, '', 'done').length, 3);
  assert.equal(visibleDecisions(changed, '', 'done').at(-1).record.id, leaf);
});
test('active descendants remain reachable below archived parents', () => {
  const { state, parent } = fixture();
  const changed = apply(state, { type: 'decision.archive', payload: { id: parent, archived: true } });
  assert.equal(visibleDecisions(changed).length, 4);
  assert.equal(visibleDecisions(changed)[0].context, true);
  assert.equal(visibleDecisions(changed, '', 'archived').length, 1);
});
test('queued changes on different fields preserve each other and use sequential versions', async () => {
  const { state, parent } = fixture(), s = server(state);
  await Promise.all([
    s.queue.command(current => fieldCommand(current, { kind: 'decision', id: parent, field: 'title', required: true }, '업체 비교', '스드메')),
    s.queue.command(current => fieldCommand(current, { kind: 'decision', id: parent, field: 'memo' }, '견적 확인', '부모 메모')),
    s.queue.command(current => fieldCommand(current, { kind: 'decision', id: parent, field: 'status' }, 'doing', 'todo')),
  ]);
  assert.equal(s.remote.state.decisions[0].title, '업체 비교');
  assert.equal(s.remote.state.decisions[0].memo, '견적 확인');
  assert.equal(s.remote.state.decisions[0].status, 'doing');
  assert.deepEqual(s.versions, [1, 2, 3]);
  assert.equal(s.maximum, 1);
  await s.queue.idle();
  assert.equal(s.counts.at(-1), 0);
});
test('a conflicting workspace version reloads and preserves an unrelated remote edit', async () => {
  const { state, parent } = fixture(), s = server(state);
  s.change({ type: 'decision.save', payload: { ...state.decisions[0], memo: '상대방의 새 메모' } });
  await s.queue.command(current => fieldCommand(current, { kind: 'decision', id: parent, field: 'title' }, '내 제목', '스드메'));
  assert.equal(s.remote.state.decisions[0].title, '내 제목');
  assert.equal(s.remote.state.decisions[0].memo, '상대방의 새 메모');
});
test('same-field conflicts retain remote content and report a reviewable conflict', async () => {
  const { state, parent } = fixture(), s = server(state);
  s.change({ type: 'decision.save', payload: { ...state.decisions[0], memo: '상대방 입력' } });
  await assert.rejects(s.queue.command(current => fieldCommand(current, { kind: 'decision', id: parent, field: 'memo' }, '내 입력', '부모 메모')), e => e.conflict && e.currentValue === '상대방 입력');
  assert.equal(s.remote.state.decisions[0].memo, '상대방 입력');
  await s.queue.command(current => fieldCommand(current, { kind: 'decision', id: parent, field: 'title' }, '다음 수정', '스드메'));
  assert.equal(s.remote.state.decisions[0].title, '다음 수정');
});
test('validation errors do not stall later writes', async () => {
  const { state, parent } = fixture(), s = server(state);
  const bad = s.queue.command(current => fieldCommand(current, { kind: 'decision', id: parent, field: 'title', required: true }, '', '스드메'));
  const good = s.queue.command(current => fieldCommand(current, { kind: 'decision', id: parent, field: 'memo' }, '다음 입력', '부모 메모'));
  await assert.rejects(bad);
  await good;
  assert.equal(s.remote.state.decisions[0].memo, '다음 입력');
});
test('money distinguishes an empty amount, optional quote, and actual zero', () => {
  assert.throws(() => parseField('', { type: 'number' }));
  assert.equal(parseField('', { type: 'number', optional: true }), null);
  assert.equal(parseField('0', { type: 'number' }), 0);
  for (const value of ['-1', '1.5', '10000000001', 'text']) assert.throws(() => parseField(value, { type: 'number' }));
});
test('editing an expense preserves its linked decision and does not invent additional payments', () => {
  const f = fixture();
  let state = apply(f.state, { type: 'decision.status', payload: { id: f.parent, status: 'done' } });
  state = apply(state, { type: 'expense.save', payload: { title: '드레스', amount: 1000, paid: 1000, status: 'paid', categoryId: 'styling', decisionId: f.parent } });
  const id = state.expenses[0].id;
  state = apply(state, fieldCommand(state, { kind: 'expense', id, field: 'amount', type: 'number' }, '1500', 1000));
  assert.equal(state.expenses[0].paid, 1000);
  assert.equal(state.expenses[0].status, 'confirmed');
  assert.equal(state.expenses[0].source.decisionId, f.parent);
  state = apply(state, fieldCommand(state, { kind: 'expense', id, field: 'status' }, 'paid', 'confirmed'));
  assert.equal(state.expenses[0].paid, 1500);
  state = apply(state, fieldCommand(state, { kind: 'expense', id, field: 'paid', type: 'number' }, '500', 1500));
  assert.equal(state.expenses[0].status, 'confirmed');
  assert.equal(state.expenses[0].paid, 500);
});
test('separate category edits preserve all categories and the latest budget', async () => {
  const s = server(initialState());
  await Promise.all([
    s.queue.command(state => fieldCommand(state, { kind: 'budget', field: 'budget', type: 'number' }, '35000000', 30000000)),
    s.queue.command(state => fieldCommand(state, { kind: 'category', id: 'venue', field: 'title' }, '웨딩홀', '예식장')),
    s.queue.command(state => fieldCommand(state, { kind: 'category', id: 'honeymoon', field: 'included' }, true, false)),
  ]);
  assert.equal(s.remote.state.settings.budget, 35000000);
  assert.equal(s.remote.state.settings.categories.length, 6);
  assert.equal(s.remote.state.settings.categories[0].title, '웨딩홀');
  assert.equal(s.remote.state.settings.categories.at(-1).included, true);
});
test('preparation checks and event notes can save together without dropping tasks', async () => {
  let state = apply(initialState(), { type: 'task.add', payload: { eventId: 'wedding', title: '반지' } });
  const taskId = state.events[0].tasks[0].id, s = server(state);
  await Promise.all([
    s.queue.command(current => fieldCommand(current, { kind: 'task', ownerId: 'wedding', id: taskId, field: 'done' }, true, false)),
    s.queue.command(current => fieldCommand(current, { kind: 'event', id: 'wedding', field: 'memo' }, '잘 챙기기', '')),
  ]);
  assert.equal(s.remote.state.events[0].tasks[0].done, true);
  assert.equal(s.remote.state.events[0].memo, '잘 챙기기');
});
test('a deleted record is not recreated by a stale field save', () => {
  const { state, parent } = fixture();
  const removed = apply(state, { type: 'decision.delete', payload: { id: parent } });
  assert.throws(() => fieldCommand(removed, { kind: 'decision', id: parent, field: 'memo' }, '입력', '부모 메모'));
});
test('unchanged values do not send another write or notification', () => {
  const { state, parent } = fixture();
  assert.equal(fieldCommand(state, { kind: 'decision', id: parent, field: 'title' }, ' 스드메 ', '스드메'), null);
  assert.equal(fieldValue(state, { kind: 'event', id: 'wedding', field: 'done' }), false);
});

test('formatted money round-trips through inline saves and form submissions without changing its value', () => {
  for (const amount of [0, 999, 1000, 3500000, 10000000000]) {
    const display = formatMoneyInput(amount);
    assert.equal(display, amount.toLocaleString('ko-KR'));
    assert.equal(parseMoneyInput(display), amount);
    assert.equal(parseField(display, { type: 'number' }), amount);
  }
  assert.equal(formatMoneyInput(null), '');
  assert.equal(formatMoneyInput('0001200'), '1,200');
  assert.equal(parseMoneyInput('', { optional: true }), null);
  for (const value of ['', '-1,000', '1.5', '1e3', '10,000,000,001', '100원']) assert.throws(() => parseMoneyInput(value));
  assert.equal(formatMoneyInput('-1,000'), '-1,000');
});

test('grouping money keeps the caret next to edited digits including selection replacement and comma deletion', () => {
  assert.deepEqual(formatMoneyEdit('1000', 4), { value: '1,000', start: 5, end: 5 });
  assert.deepEqual(formatMoneyEdit('19,234', 2), { value: '19,234', start: 2, end: 2 });
  assert.deepEqual(formatMoneyEdit('1,0000', 3), { value: '10,000', start: 2, end: 2 });
  assert.deepEqual(formatMoneyEdit('1000', 1), { value: '1,000', start: 1, end: 1 });
  assert.deepEqual(formatMoneyEdit('012', 1), { value: '12', start: 0, end: 0 });
  assert.deepEqual(formatMoneyEdit('3500000', 1, 4), { value: '3,500,000', start: 1, end: 5 });
  assert.deepEqual(formatMoneyEdit('', 0), { value: '', start: 0, end: 0 });
});

function budgetFixture() {
  let state = initialState();
  for (const [title, categoryId, amount, paid, status] of [
    ['대관료', 'venue', 3000000, 1000000, 'confirmed'],
    ['식대', 'venue', 8000000, 0, 'estimated'],
    ['드레스', 'styling', 500000, 500000, 'paid'],
    ['항공권', 'honeymoon', 2000000, 0, 'estimated'],
  ]) state = apply(state, { type: 'expense.save', payload: { title, categoryId, amount, paid, status } });
  return state;
}

test('budget groups preserve empty categories, show each expense once, and search category names', () => {
  const state = budgetFixture(), groups = visibleExpenseGroups(state);
  assert.deepEqual(groups.map(g => g.id), state.settings.categories.map(c => c.id));
  assert.deepEqual(groups.flatMap(g => g.expenses.map(e => e.title)), ['대관료', '식대', '드레스', '항공권']);
  assert.deepEqual(visibleExpenseGroups(state, '예식장')[0].expenses.map(e => e.title), ['대관료', '식대']);
  assert.equal(visibleExpenseGroups(state, '대관')[0].id, 'venue');
  assert.equal(visibleExpenseGroups(state, '없음').length, 0);
  assert.equal(visibleExpenseGroups(state, '예복')[0].expenses.length, 0);
});

test('moving an expense between categories transfers its totals once and preserves paid amounts', () => {
  let state = budgetFixture();
  const before = budgetSummary(state), expense = state.expenses[0];
  state = apply(state, fieldCommand(state, { kind: 'expense', id: expense.id, field: 'categoryId' }, 'styling', 'venue'));
  const after = budgetSummary(state);
  assert.equal(after.total, before.total);
  assert.equal(after.paid, before.paid);
  assert.equal(after.rows.find(c => c.id === 'venue').total, 8000000);
  assert.equal(after.rows.find(c => c.id === 'venue').paid, 0);
  assert.equal(after.rows.find(c => c.id === 'styling').total, 3500000);
  assert.equal(after.rows.find(c => c.id === 'styling').paid, 1500000);
  assert.equal(visibleExpenseGroups(state).flatMap(g => g.expenses).filter(e => e.id === expense.id).length, 1);
});

test('status filters and archives leave overall totals intact and excluded groups stay available', () => {
  let state = budgetFixture();
  state = apply(state, { type: 'expense.archive', payload: { id: state.expenses[1].id, archived: true } });
  const summary = budgetSummary(state);
  assert.equal(summary.total, 3500000);
  assert.equal(summary.paid, 1500000);
  assert.equal(summary.rows.find(c => c.id === 'honeymoon').total, 2000000);
  assert.equal(visibleExpenseGroups(state, '', 'confirmed')[0].expenses[0].title, '대관료');
  assert.equal(visibleExpenseGroups(state, '', 'paid')[0].expenses[0].title, '드레스');
  assert.equal(visibleExpenseGroups(state, '', 'archived')[0].expenses[0].title, '식대');
  assert.equal(visibleExpenseGroups(state).flatMap(g => g.expenses).length, 3);
  assert.deepEqual(budgetSummary(state), summary);
});

test('a formatted quote stays out of the budget and formatted expense edits preserve partial payments', () => {
  let state = budgetFixture();
  state = apply(state, { type: 'decision.save', payload: { title: '후보 비교' } });
  const decisionId = state.decisions.at(-1).id, before = budgetSummary(state);
  state = apply(state, { type: 'candidate.save', payload: { decisionId, title: '후보 A', quote: null } });
  const candidate = state.decisions.at(-1).options[0];
  state = apply(state, fieldCommand(state, { kind: 'candidate', ownerId: decisionId, id: candidate.id, field: 'quote', type: 'number', optional: true }, '3,500,000', null));
  assert.deepEqual(budgetSummary(state), before);
  state = apply(state, fieldCommand(state, { kind: 'expense', id: state.expenses[0].id, field: 'amount', type: 'number' }, '3,500,000', 3000000));
  assert.equal(state.expenses[0].amount, 3500000);
  assert.equal(state.expenses[0].paid, 1000000);
  assert.equal(budgetSummary(state).total, before.total + 500000);
});
