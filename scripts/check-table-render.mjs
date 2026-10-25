import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire, registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState, applyCommand } from '../lib/domain.mjs';
import { fieldKey, recordAnchor, visibleDecisions, visibleEvents } from '../lib/inline-planner.mjs';

// Render the real React components in Node without a browser, database, or
// development server. Use the same JSX compiler already bundled with Next.
const require = createRequire(import.meta.url), swc = require('next/dist/build/swc');
await swc.loadBindings();
const appURL = new URL('../app/', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(appURL) && !/\.[a-z]+$/.test(specifier)) {
      for (const extension of ['.jsx', '.js']) {
        const url = new URL(specifier + extension, context.parentURL);
        if (existsSync(url)) return next(url.href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(appURL) && /\.jsx?$/.test(url)) {
      const { code } = swc.transformSync(readFileSync(new URL(url), 'utf8'), { filename: new URL(url).pathname, jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2022', transform: { react: { runtime: 'automatic' } } }, module: { type: 'es6' } });
      return { format: 'module', source: code, shortCircuit: true };
    }
    return next(url, context);
  },
});
const { ScheduleTimeline, ScheduleTable, DecisionTable } = await import('../app/planner-table.jsx');
const { InlineContext } = await import('../app/inline-fields.jsx');
const { default: PlannerFields } = await import('../app/planner-forms.jsx');
hooks.deregister();

let serial = 0;
const apply = (state, type, payload) => applyCommand(state, { type, payload }, 'groom', { id: `render-${++serial}`, now: '2026-10-25T12:00:00Z' }).state;
function fixture() {
  let state = apply(initialState(), 'event.save', { title: '드레스 피팅', itemId: 'item-1', date: '2026-11-14', memo: '긴 메모도 상세에서 수정', newTasks: '구두\n사진' });
  state = apply(state, 'decision.save', { title: '업체 정하기', itemId: 'item-0' });
  const parent = state.decisions.at(-1).id;
  state = apply(state, 'decision.save', { title: '드레스 선택', parentId: parent, itemId: 'item-1', memo: '실크 원단', result: 'A라인' });
  const child = state.decisions.at(-1).id;
  state = apply(state, 'candidate.save', { decisionId: child, title: '후보 A', quote: 3500000 });
  return { state, parent, child };
}
function render(state, component, props, drafts = {}) {
  const context = { state, saves: { drafts }, queue: {}, open() {}, remove() {}, storageEnabled: false };
  return renderToStaticMarkup(h(InlineContext.Provider, { value: context }, h(component, { expanded: {}, sort: { key: 'date', direction: 'asc' }, toggle() {}, onSort() {}, ...props })));
}

test('the original timeline keeps all dated events in order, completion marks, and the wedding milestone', () => {
  const state = { ...initialState(), events: [
    { id: 'wedding', title: '결혼식', date: '2027-09-25', time: '14:00' },
    { id: 'late', title: '오후 피팅', date: '2026-11-14', time: '15:00' },
    { id: 'undated', title: '날짜 없는 일정', date: '' },
    { id: 'archived', title: '보관한 일정', date: '2026-10-01', archived: true },
    { id: 'early', title: '오전 투어', date: '2026-11-14', time: '10:00', done: true },
  ] };
  const html = render(state, ScheduleTimeline, { onSelect() {} });
  assert.match(html, /aria-label="날짜순 일정 흐름"/);
  assert.ok(html.indexOf('오전 투어') < html.indexOf('오후 피팅'));
  assert.ok(html.indexOf('오후 피팅') < html.indexOf('결혼식'));
  assert.match(html, /오전 투어, 2026-11-14, 완료 상세로 이동/);
  assert.match(html, /✓ 오전 투어/);
  assert.match(html, /class="simple-dot wedding">♡/);
  assert.doesNotMatch(html, /날짜 없는 일정|보관한 일정/);
  assert.equal((html.match(/<button/g) || []).length, 3);
  assert.deepEqual(state.events.map(event => event.id), ['wedding', 'late', 'undated', 'archived', 'early']);
  assert.equal(render({ ...state, events: state.events.slice(0, 1) }, ScheduleTimeline, { onSelect() {} }), '');
});

test('the schedule overview renders compact table cells instead of all detail forms', () => {
  const { state } = fixture(), html = render(state, ScheduleTable, { records: visibleEvents(state) });
  assert.match(html, /<table/);
  assert.match(html, /<caption/);
  assert.match(html, /aria-sort="ascending"/);
  assert.match(html, /0\/2 완료/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, state.events.length);
  assert.doesNotMatch(html, /<textarea|type="date"|기본 준비물 불러오기/);
  for (const event of state.events) assert.match(html, new RegExp(`id="${recordAnchor('event', event.id)}"`));
});

test('expanding a single row renders its details without duplicate record anchors', () => {
  const { state } = fixture(), record = state.events.at(-1), key = recordAnchor('event', record.id);
  const html = render(state, ScheduleTable, { records: visibleEvents(state), expanded: { [key]: true } });
  assert.match(html, /긴 메모도 상세에서 수정/);
  assert.match(html, /기본 준비물 불러오기/);
  assert.equal((html.match(/class="planner-detail-row"/g) || []).length, 1);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('filtered decision tables keep ancestor context and show candidate amounts only in expanded details', () => {
  const { state, parent, child } = fixture(), rows = visibleDecisions(state, '실크', 'all', 'item-1');
  const collapsed = render(state, DecisionTable, { rows });
  assert.ok(collapsed.indexOf(`id="record-decision-${parent}"`) < collapsed.indexOf(`id="record-decision-${child}"`));
  assert.match(collapsed, /상위 항목/);
  assert.match(collapsed, /planner-cell-readonly/);
  assert.doesNotMatch(collapsed, /value="3,500,000"/);
  const expanded = render(state, DecisionTable, { rows, expanded: { [recordAnchor('decision', child)]: true } });
  assert.match(expanded, /value="3,500,000"/);
});

test('failed cell edits stay visible and actionable even when the row is collapsed', () => {
  const { state, child } = fixture(), config = { kind: 'decision', id: child, field: 'result' };
  const drafts = { [fieldKey(config)]: { config, value: '수정 중인 결과', status: 'error', error: '연결을 확인해 주세요.' } };
  const html = render(state, DecisionTable, { rows: visibleDecisions(state) }, drafts);
  assert.match(html, /<textarea[^>]*>수정 중인 결과<\/textarea>/);
  assert.match(html, /role="alert"/);
  assert.match(html, /다시 저장/);
});

test('new event forms preselect the category provided by the active filter', () => {
  const { state } = fixture();
  const html = renderToStaticMarkup(h(PlannerFields, { state, modal: { type: 'event.save', record: { itemId: 'item-1' } } }));
  assert.match(html, /<select name="itemId">/);
  assert.match(html, /<option value="item-1" selected="">/);
});
