import { decisionTemplates, checklistTemplates } from './planning-templates.mjs';
// Pure domain model. Only the server supplies actor, id and now.
export class DomainError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message) => { throw new DomainError(message); };
export const PEOPLE = { groom: '오성현', bride: '정지윤' };
export function roleForUser(user, emails) {
  if (!user?.id || user.emailVerified !== true || typeof user.email !== 'string') return null;
  const email = user.email.trim().toLowerCase();
  return email === emails.groom ? 'groom' : email === emails.bride ? 'bride' : null;
}
export function text(value, max = 200, optional = false) {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) fail('내용과 길이를 확인해 주세요.');
  return value.trim();
}
export function money(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000000000) fail('금액은 0원 이상, 100억 원 이하 정수로 입력해 주세요.');
  return value;
}
function bool(value) { if (typeof value !== 'boolean') fail('상태 값이 올바르지 않아요.'); return value; }
function find(list, id) { return list.find(x => x.id === id) || fail('항목을 찾지 못했어요. 새로고침해 주세요.'); }
export function both(votes) { return Boolean(votes?.groom && votes?.bride); }
export function date(value) {
  if (value === '') return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('날짜를 확인해 주세요.');
  return value;
}
export function safeLink(value) {
  let url; try { url = new URL(value); } catch { fail('올바른 링크를 입력해 주세요.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('http 또는 https 링크를 사용해 주세요.');
  return text(url.href, 2000);
}
export function initialState() {
  return {
    schema: 2,
    settings: { budget: 30000000, scope: '결혼 준비 · 결혼식', categories: [
      { id: 'venue', title: '예식장', included: true }, { id: 'styling', title: '스드메', included: true },
      { id: 'rings', title: '예복 · 예물', included: true }, { id: 'invitation', title: '청첩장 · 답례품', included: true },
      { id: 'other', title: '기타 준비', included: true }, { id: 'honeymoon', title: '신혼여행', included: false },
    ] },
    budgetProposal: null,
    items: ['예식장', '스튜디오 · 드레스 · 메이크업', '예복 · 예물', '청첩장', '신혼여행'].map((title, i) => ({ id: `item-${i}`, title, archived: false })),
    decisions: [], expenses: [], notes: [], comments: [], attachments: [],
    events: [{ id: 'wedding', title: '우리의 결혼식', date: '2027-09-25', time: '14:00', place: '', memo: '', itemId: '', revision: 1, done: false }],
    notifications: [],
  };
}
function targetExists(state, kind, id) {
  const fields = { item: 'items', decision: 'decisions', event: 'events', expense: 'expenses', note: 'notes' };
  if (kind === 'candidate') {
    if (!state.decisions.some(d => d.options.some(o => o.id === id))) fail('후보를 찾지 못했어요.');
  } else if (Object.hasOwn(fields, kind)) find(state[fields[kind]], id);
  else fail('연결할 항목을 확인해 주세요.');
}
// Read old workspaces without losing notes, candidates, comments or amounts.
// The first successful write persists this idempotent migration atomically.
export function normalizeState(current) {
  const state = JSON.parse(JSON.stringify(current));
  if (![1, 2].includes(state.schema)) fail('지원하지 않는 데이터 형식이에요.');
  if (state.schema === 1) {
    const legacyComplete = (d, seen = new Set()) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return !d.archived && both(d.votes) && !!d.selectedId && state.decisions.filter(c => !c.archived && c.parentId === d.id).every(c => legacyComplete(c, new Set(seen)));
    };
    state.decisions = state.decisions.map(d => ({ ...d,
      archived: !!d.archived || !!state.items.find(i => i.id === d.itemId)?.archived,
      status: legacyComplete(d) ? 'done' : d.selectedId ? 'doing' : 'todo',
      result: d.options.find(o => o.id === d.selectedId)?.title || '',
      memo: d.reason || '',
    }));
    for (const note of state.notes || []) if (!state.decisions.some(d => d.id === note.id)) {
      state.decisions.push({ ...note, parentId: '', options: [], selectedId: '', result: '', memo: '', status: note.done ? 'done' : 'todo', archived: !!note.archived });
    }
    for (const a of state.attachments || []) if (a.kind === 'note') a.kind = 'decision';
    state.expenses = state.expenses.map(e => ({ ...e, status: expenseStatus(e), dueDate: '' }));
    // Pending proposals were never applied. Preserve them, but keep the actual budget.
    state.schema = 2;
  }
  return state;
}
export function expenseStatus(e) {
  return e.status || (e.amount > 0 && e.paid === e.amount ? 'paid' : both(e.votes) ? 'confirmed' : 'estimated');
}
export function decisionComplete(state, id) {
  const d = state.decisions.find(x => x.id === id);
  return !!d && !d.archived && d.status === 'done';
}
export function budgetSummary(state) {
  const rows = state.settings.categories.map(category => {
    let paid = 0, committed = 0, estimated = 0;
    for (const e of state.expenses.filter(e => !e.archived && e.categoryId === category.id)) {
      paid += e.paid;
      if (expenseStatus(e) !== 'estimated') committed += e.amount - e.paid;
      else estimated += e.amount - e.paid;
    }
    return { ...category, paid, committed, estimated, total: paid + committed + estimated };
  });
  const active = rows.filter(row => row.included);
  const paid = active.reduce((a, r) => a + r.paid, 0), committed = active.reduce((a, r) => a + r.committed, 0), estimated = active.reduce((a, r) => a + r.estimated, 0);
  const total = paid + committed + estimated, budget = state.settings.budget;
  const axis = Math.max(budget, total, 1) * 1.1;
  return { rows, paid, committed, estimated, total, budget, remaining: budget - total, axis, ratio: budget ? total / budget : null };
}
export function applyCommand(current, command, actor, meta) {
  if (!Object.hasOwn(PEOPLE, actor)) throw new DomainError('이 공간에 접근할 수 없어요.', 403);
  if (!command || typeof command !== 'object') fail('요청을 확인해 주세요.');
  const state = normalizeState(current);
  const { type, payload: p = {} } = command;
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail('요청 내용을 확인해 주세요.');
  const { id, now } = meta;
  let message = '', target = 'timeline';
  switch (type) {
    case 'item.add': state.items.push({ id, title: text(p.title), archived: false }); target = 'decisions'; break;
    case 'item.update': {
      const item = find(state.items, p.id); item.title = text(p.title); item.archived = bool(p.archived); target = 'decisions'; break;
    }
    case 'decision.save': {
      const old = p.id ? find(state.decisions, p.id) : null;
      const status = p.status || old?.status || 'todo';
      if (!['todo', 'doing', 'done'].includes(status)) fail('결정 상태를 확인해 주세요.');
      const record = { ...old, id: old?.id || id, title: text(p.title), itemId: p.itemId ? find(state.items, p.itemId).id : '',
        status, result: text(p.result || '', 2000, true), memo: text(p.memo || '', 5000, true),
        options: old?.options || [], selectedId: old?.selectedId || '', parentId: old?.parentId || '', archived: old?.archived || false };
      if (old) state.decisions[state.decisions.indexOf(old)] = record; else state.decisions.push(record);
      message = '저장했어요.'; target = 'decisions'; break;
    }
    case 'decision.status': {
      const d = find(state.decisions, p.id);
      if (d.archived || !['todo', 'doing', 'done'].includes(p.status)) fail('결정 상태를 확인해 주세요.');
      d.status = p.status; target = 'decisions'; break;
    }
    case 'decision.archive': find(state.decisions, p.id).archived = bool(p.archived); target = 'decisions'; break;
    case 'templates.add': {
      if (!Array.isArray(p.ids) || !p.ids.length || p.ids.length > decisionTemplates.length) fail('추가할 항목을 선택해 주세요.');
      for (const key of new Set(p.ids)) {
        const t = find(decisionTemplates, key);
        if (state.decisions.some(d => d.templateId === key)) continue;
        let item = state.items.find(i => i.title === t.group);
        if (!item) { item = { id: id + '-group-' + key, title: t.group, archived: false }; state.items.push(item); }
        state.decisions.push({ id: id + '-' + key, templateId: key, title: t.title, itemId: item.id, parentId: '', options: [], selectedId: '', result: '', memo: t.hint, status: 'todo', archived: false });
      }
      message = '선택한 항목을 추가했어요.'; target = 'decisions'; break;
    }
    case 'decision.add': {
      const item = find(state.items, p.itemId);
      if (item.archived) fail('보관한 준비 항목에는 질문을 추가할 수 없어요.');
      if (p.parentId) {
        let parent = find(state.decisions, p.parentId), depth = 1;
        if (parent.itemId !== item.id || parent.archived) fail('상위 질문을 확인해 주세요.');
        while (parent.parentId) { parent = find(state.decisions, parent.parentId); if (++depth >= 20) fail('질문 깊이는 20단계까지 가능해요. 별도 질문으로 추가해 주세요.'); }
      }
      state.decisions.push({ id, itemId: item.id, parentId: p.parentId || '', title: text(p.title), options: [], selectedId: '', result: '', memo: '', status: 'todo', revision: 1, archived: false });
      message = '함께 정할 질문을 추가했어요.'; target = 'decisions'; break;
    }
    case 'decision.update': {
      const d = find(state.decisions, p.id); d.title = text(p.title); d.archived = bool(p.archived); target = 'decisions'; break;
    }
    case 'candidate.save': {
      const d = find(state.decisions, p.decisionId);
      if (d.archived) fail('보관한 질문은 먼저 복원해 주세요.');
      const option = { id: p.id ? find(d.options, p.id).id : id, title: text(p.title), detail: text(p.detail || '', 5000, true), quote: p.quote === null ? null : money(p.quote), link: p.link ? safeLink(p.link) : '', archived: p.id ? !!find(d.options, p.id).archived : false };
      if (p.id) d.options[d.options.findIndex(o => o.id === p.id)] = option; else d.options.push(option);
      if (d.selectedId === option.id) d.result = option.title; message = '후보를 저장했어요.'; target = 'decisions'; break;
    }
    case 'candidate.archive': {
      const d = find(state.decisions, p.decisionId), option = find(d.options, p.id);
      option.archived = bool(p.archived);
      if (d.selectedId === option.id && option.archived) { d.selectedId = ''; d.status = 'doing'; if (d.result === option.title) d.result = ''; } message = '후보를 정리했어요.'; target = 'decisions'; break;
    }
    case 'decision.select': {
      const d = find(state.decisions, p.id); if (d.archived) fail('보관한 질문이에요.');
      const selected = find(d.options, p.optionId); if (selected.archived) fail('보관한 후보는 먼저 복원해 주세요.');
      d.selectedId = selected.id; d.result = selected.title; d.status = 'done';
      message = '결정 완료로 저장했어요.'; target = 'decisions'; break;
    }
    case 'event.save': {
      const old = p.id ? find(state.events, p.id) : null;
      const time = text(p.time || '', 5, true); if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail('시간을 확인해 주세요.');
      const day = date(p.date || ''); if (time && !day) fail('시간을 입력하려면 날짜를 먼저 정해 주세요.');
      const event = { id: old?.id || id, title: text(p.title), date: day, time, place: text(p.place || '', 300, true), memo: text(p.memo || '', 5000, true), itemId: p.itemId ? find(state.items, p.itemId).id : '', tasks: old?.tasks || [], revision: (old?.revision || 0) + 1, done: old?.done || false, archived: old?.archived || false };
      if (p.taskStates) {
        if (!Array.isArray(p.taskStates)) fail('체크리스트를 확인해 주세요.');
        for (const t of p.taskStates) find(event.tasks, t.id).done = bool(t.done);
      }
      if (p.checklistId) {
        const template = find(checklistTemplates, p.checklistId);
        for (const [i, title] of template.tasks.entries()) if (!event.tasks.some(t => t.title === title)) event.tasks.push({ id: id + '-task-' + i, title, done: false });
      }
      if (p.newTasks) {
        const tasks = text(p.newTasks, 5000, true).split('\n').map(t => t.trim()).filter(Boolean);
        if (tasks.length > 30) fail('한 번에 30개까지 추가할 수 있어요.');
        for (const [i, title] of tasks.entries()) event.tasks.push({ id: id + '-new-' + i, title: text(title), done: false });
      }
      if (old) state.events[state.events.indexOf(old)] = event; else state.events.push(event);
      message = '일정을 저장했어요.'; break;
    }
    case 'event.done': {
      const e = find(state.events, p.id); if (e.archived) fail('보관한 일정이에요.'); e.done = bool(p.done); break;
    }
    case 'task.add': {
      const e = find(state.events, p.eventId); if (e.archived) fail('보관한 일정이에요.');
      e.tasks ||= []; e.tasks.push({ id, title: text(p.title), done: false }); e.done = false;
      message = '일정의 준비할 일을 추가했어요.'; break;
    }
    case 'task.update': {
      const e = find(state.events, p.eventId), task = find(e.tasks || [], p.id);
      task.title = text(p.title); task.done = bool(p.done); task.archived = bool(p.archived);
      if (!task.done && !task.archived) e.done = false; break;
    }
    case 'event.archive': { const e = find(state.events, p.id); if (e.id === 'wedding') fail('결혼식은 삭제 대신 수정해 주세요.'); e.archived = bool(p.archived); break; }
    case 'expense.save': {
      const old = p.id ? find(state.expenses, p.id) : null;
      const status = p.status || old?.status || 'estimated';
      if (!['estimated', 'confirmed', 'paid'].includes(status)) fail('지출 상태를 확인해 주세요.');
      const amount = money(p.amount), paid = status === 'paid' ? amount : money(p.paid);
      const dueDate = date(p.dueDate || ''); if (paid > amount) fail('지급액은 총금액보다 클 수 없어요.');
      const categoryId = find(state.settings.categories, p.categoryId).id;
      const title = text(p.title), detail = text(p.detail || '', 2000, true);
      let source = null;
      if (p.decisionId) { const d = find(state.decisions, p.decisionId); if ((d.status !== 'done' || d.archived) && old?.source?.decisionId !== d.id) fail('완료한 결정만 연결할 수 있어요.'); source = { decisionId: d.id, optionId: d.selectedId }; }
      if (source && state.expenses.some(e => !e.archived && e.id !== old?.id && e.source?.decisionId === source.decisionId)) fail('이미 지출로 기록한 결정이에요. 기존 항목을 수정해 주세요.');
      const expense = { ...old, id: old?.id || id, title, amount, paid, detail, categoryId, source, status: amount > 0 && paid === amount ? 'paid' : status, dueDate, archived: old?.archived || false };
      if (old) state.expenses[state.expenses.indexOf(old)] = expense; else state.expenses.push(expense);
      message = '지출 기록을 갱신했어요.'; target = 'budget'; break;
    }
    case 'expense.archive': {
      const e = find(state.expenses, p.id); if (e.paid > 0 && p.archived) fail('지급 기록이 있는 항목은 보관할 수 없어요. 잘못된 지급액을 먼저 수정해 주세요.');
      e.archived = bool(p.archived); target = 'budget'; break;
    }
    case 'budget.save': {
      const budget = money(p.budget), scope = text(p.scope, 200);
      if (!Array.isArray(p.categories) || !p.categories.length || p.categories.length > 30) fail('분류는 1~30개로 설정해 주세요.');
      const categories = p.categories.map((c, i) => ({ id: c.id ? find(state.settings.categories, c.id).id : `${id}-${i}`, title: text(c.title, 60), included: bool(c.included) }));
      if (new Set(categories.map(c => c.id)).size !== categories.length) fail('중복된 분류가 있어요.');
      if (state.expenses.some(e => !categories.some(c => c.id === e.categoryId))) fail('기록이 있는 분류는 삭제 대신 예산 포함을 해제해 주세요.');
      state.settings = { budget, scope, categories }; state.budgetProposal = null;
      message = '예산을 변경했어요.'; target = 'budget'; break;
    }
    case 'attachment.add':
      targetExists(state, p.kind, p.targetId);
      // Object metadata is provided exclusively by the authenticated upload endpoint.
      if (!meta.attachment && !p.url) fail('첨부 파일을 확인해 주세요.');
      state.attachments.push({ id, kind: p.kind, targetId: p.targetId, title: text(p.title), author: actor, createdAt: now,
        ...(p.url ? { url: safeLink(p.url) } : meta.attachment) }); target = p.kind === 'expense' ? 'budget' : p.kind === 'event' ? 'timeline' : 'decisions'; break;
    case 'notification.read':
      for (const n of state.notifications) if (n.to === actor) n.read = true; target = 'notifications'; break;
    default: fail('지원하지 않는 작업이에요.');
  }
  let entityId = p.targetId || p.decisionId || p.id || id;
  if (type.startsWith('task.')) entityId = p.eventId;
  if (p.kind === 'candidate') entityId = state.decisions.find(d => d.options.some(o => o.id === p.targetId))?.id || '';
  if (type.startsWith('budget.')) entityId = '';
  if (message) state.notifications.unshift({ id, to: actor === 'groom' ? 'bride' : 'groom', title: message, target, entityId, createdAt: now, read: false });
  state.notifications = state.notifications.slice(0, 200);
  if (JSON.stringify(state).length > 2000000) fail('기록 용량을 초과했어요. 자료를 정리해 주세요.');
  return { state, message: message || '저장했어요.', target };
}
