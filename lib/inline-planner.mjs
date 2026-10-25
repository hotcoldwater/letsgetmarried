import { decisionPath, expenseStatus } from './domain.mjs';
import { parseMoneyInput } from './money-input.mjs';

export const fieldKey = ({ kind, id = '', ownerId = '', field }) => [kind, ownerId, id, field].join(':');
export const recordAnchor = (kind, id) => `record-${kind}-${id}`;
const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
const required = record => {
  if (!record) throw new Error('항목이 삭제되었거나 이동했어요. 입력한 내용은 이 화면에 남겨 두었어요.');
  return record;
};

export function fieldRecord(state, { kind, id, ownerId }) {
  if (kind === 'budget') return state.settings;
  if (kind === 'category') return required(state.settings.categories.find(c => c.id === id));
  if (kind === 'candidate') return required(state.decisions.find(d => d.id === ownerId)?.options.find(o => o.id === id));
  if (kind === 'task') return required(state.events.find(e => e.id === ownerId)?.tasks?.find(t => t.id === id));
  return required(state[{ item: 'items', event: 'events', decision: 'decisions', expense: 'expenses', archive: 'archives' }[kind]].find(r => r.id === id));
}

export function fieldValue(state, config) {
  const record = fieldRecord(state, config);
  if (config.kind === 'expense' && config.field === 'decisionId') return record.source?.decisionId || '';
  if (config.kind === 'expense' && config.field === 'status') return expenseStatus(record);
  if (['done', 'included', 'archived'].includes(config.field)) return !!record[config.field];
  return record[config.field] ?? '';
}

export function parseField(value, config) {
  if (config.type === 'number') {
    return parseMoneyInput(value, config);
  }
  if (typeof value === 'boolean') return value;
  const text = String(value).trim();
  if (config.required && !text) throw new Error('내용을 입력해 주세요.');
  if (config.maxLength && text.length > config.maxLength) throw new Error(`${config.maxLength}자 이내로 입력해 주세요.`);
  return text;
}

// Assemble each edit from the latest acknowledged snapshot, never from a stale
// card's full form. The workspace's existing compare-and-swap remains in force.
export function fieldCommand(state, config, input, base) {
  const value = parseField(input, config), current = fieldValue(state, config);
  if (same(current, value)) return null;
  if (!same(current, base)) {
    const error = new Error('같은 내용을 다른 곳에서 수정했어요. 최신 내용과 내 입력을 확인해 주세요.');
    error.conflict = true;
    error.currentValue = current;
    throw error;
  }
  const { kind, id, ownerId, field } = config;
  const record = fieldRecord(state, config);
  const payload = { ...record, [field]: value };
  if (kind === 'event' && field === 'done') return { type: 'event.done', payload: { id, done: value } };
  if (kind === 'decision' && field === 'status') return { type: 'decision.status', payload: { id, status: value } };
  if (kind === 'task') return { type: 'task.update', payload: { archived: false, ...payload, eventId: ownerId } };
  if (kind === 'candidate') return { type: 'candidate.save', payload: { ...payload, decisionId: ownerId } };
  if (kind === 'item') return { type: 'item.update', payload };
  if (kind === 'category') return { type: 'budget.save', payload: { ...state.settings, categories: state.settings.categories.map(c => c.id === id ? payload : c) } };
  if (kind === 'budget') return { type: 'budget.save', payload };
  if (kind === 'expense') {
    payload.decisionId = field === 'decisionId' ? value : record.source?.decisionId || '';
    payload.status = field === 'status' ? value : expenseStatus(record);
    // Increasing an already paid contract must not mark the increase as paid.
    if (['amount', 'paid'].includes(field) && payload.status === 'paid' && payload.paid < payload.amount) payload.status = 'confirmed';
  }
  return { type: `${kind}.save`, payload };
}

// All edits, additions and uploads share one queue. A later write uses the
// version returned by the previous write, including edits in another tab.
export function createWorkspaceQueue({ getSnapshot, receive, post, reload, pendingChanged = () => {} }) {
  let tail = Promise.resolve(), pending = 0;
  function enqueue(operation) {
    pendingChanged(++pending);
    const result = tail.then(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const snapshot = getSnapshot();
        try {
          const data = await operation(snapshot, post);
          if (data) receive(data);
          return data;
        } catch (error) {
          if (error.status !== 409 || attempt) throw error;
          receive(await reload());
        }
      }
    });
    tail = result.catch(() => {}).finally(() => pendingChanged(--pending));
    return result;
  }
  return {
    enqueue,
    command: build => enqueue(async (snapshot, send) => {
      const command = typeof build === 'function' ? build(snapshot.state) : build;
      return command ? send(command, snapshot.version) : null;
    }),
    idle: () => tail,
    get pending() { return pending; },
  };
}

export function searchableText(record, state, kind) {
  const files = state.attachments.filter(a => a.kind === kind && a.targetId === record.id);
  return [
    record.title, record.result, record.memo, record.detail, record.place, record.date, record.party, record.tags,
    ...(record.files || []).filter(f => !f.deletedAt).map(f => f.title),
    ...(record.tasks || []).filter(t => !t.archived).map(t => t.title),
    ...(record.options || []).map(o => [o.title, o.detail, o.link].join(' ')),
    ...files.map(a => a.title),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function visibleExpenseGroups(state, query = '', filter = 'active') {
  const search = query.trim().toLowerCase();
  return state.settings.categories.map(category => ({
    ...category,
    expenses: state.expenses.filter(expense => expense.categoryId === category.id
      && (filter === 'archived' ? expense.archived : !expense.archived)
      && (!['estimated', 'confirmed', 'paid'].includes(filter) || expenseStatus(expense) === filter)
      && (!search || category.title.toLowerCase().includes(search) || searchableText(expense, state, 'expense').includes(search))),
  })).filter(category => (!search && filter === 'active') || category.expenses.length > 0 || (filter === 'active' && category.title.toLowerCase().includes(search)));
}

export function defaultPlannerViews() {
  return {
    timeline: { query: '', filter: 'all', category: 'all', sort: { key: 'date', direction: 'asc' } },
    decisions: { query: '', filter: 'all', category: 'all', sort: { key: 'manual', direction: 'asc' } },
    budget: { query: '', filter: 'active', category: 'all', sort: { key: 'manual', direction: 'asc' } },
  };
}

export function matchesPlanningCategory(record, category = 'all') {
  return category === 'all' || (category === 'unassigned' ? !record.itemId : record.itemId === category);
}

function planningSearch(record, state, kind, query) {
  const category = state.items.find(item => item.id === record.itemId)?.title || '미분류';
  return `${category.toLowerCase()} ${searchableText(record, state, kind)}`.includes(query.trim().toLowerCase());
}

function planningComparator(state, kind, sort = {}) {
  const direction = sort.direction === 'desc' ? -1 : 1;
  const categoryRank = id => { const index = state.items.findIndex(item => item.id === id); return index < 0 ? state.items.length : index; };
  const statusRank = record => kind === 'event' ? Number(!!record.done) : ({ todo: 0, doing: 1, done: 2 }[record.status] ?? 0);
  return (a, b) => {
    if (sort.key === 'category') return (categoryRank(a.itemId) - categoryRank(b.itemId)) * direction;
    if (sort.key === 'status') return (statusRank(a) - statusRank(b)) * direction;
    if (sort.key === 'title') return a.title.localeCompare(b.title, 'ko') * direction;
    if (sort.key === 'date') {
      // Undated appointments stay at the bottom in either direction.
      if (!a.date || !b.date) return Number(!a.date) - Number(!b.date);
      return (a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')) * direction;
    }
    return 0;
  };
}

export function visibleEvents(state, query = '', filter = 'all', category = 'all', sort = { key: 'date', direction: 'asc' }) {
  const chronological = planningComparator(state, 'event', { key: 'date', direction: 'asc' }), compare = planningComparator(state, 'event', sort);
  return state.events.filter(event => (filter === 'archived' ? event.archived : !event.archived)
    && (filter === 'active' ? !event.done : filter === 'done' ? event.done : true)
    && matchesPlanningCategory(event, category) && planningSearch(event, state, 'event', query))
    .sort((a, b) => compare(a, b) || chronological(a, b));
}

export function visibleDecisions(state, query = '', filter = 'all', category = 'all', sort = { key: 'manual', direction: 'asc' }) {
  const byId = new Map(state.decisions.map(d => [d.id, d])), matches = new Set();
  for (const d of state.decisions) {
    const visible = filter === 'archived' ? d.archived : !d.archived;
    const status = filter === 'active' ? d.status !== 'done' : ['todo', 'doing', 'done'].includes(filter) ? d.status === filter : true;
    if (visible && status && matchesPlanningCategory(d, category) && planningSearch(d, state, 'decision', query)) matches.add(d.id);
  }
  const included = new Set(matches);
  for (const id of matches) for (const parent of decisionPath(state, id)) included.add(parent.id);
  const children = new Map();
  for (const d of state.decisions) {
    const parentId = byId.has(d.parentId) ? d.parentId : '';
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(d);
  }
  for (const siblings of children.values()) siblings.sort(planningComparator(state, 'decision', sort));
  const rows = [], visited = new Set();
  function visit(d, depth) {
    if (visited.has(d.id) || !included.has(d.id)) return;
    visited.add(d.id);
    rows.push({ record: d, depth, context: !matches.has(d.id) });
    for (const child of children.get(d.id) || []) visit(child, depth + 1);
  }
  for (const d of children.get('') || []) visit(d, 0);
  for (const d of state.decisions) visit(d, 0);
  return rows;
}
