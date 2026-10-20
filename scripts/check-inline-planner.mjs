import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, initialState } from '../lib/domain.mjs';
import { createWorkspaceQueue, fieldCommand, fieldValue, parseField, visibleDecisions } from '../lib/inline-planner.mjs';

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
