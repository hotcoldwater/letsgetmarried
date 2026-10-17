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
    schema: 1,
    settings: { budget: 30000000, scope: '결혼 준비 · 결혼식', categories: [
      { id: 'venue', title: '예식장', included: true }, { id: 'styling', title: '스드메', included: true },
      { id: 'rings', title: '예복 · 예물', included: true }, { id: 'invitation', title: '청첩장 · 답례품', included: true },
      { id: 'other', title: '기타 준비', included: true }, { id: 'honeymoon', title: '신혼여행', included: false },
    ] },
    budgetProposal: null,
    items: ['예식장', '스튜디오 · 드레스 · 메이크업', '예복 · 예물', '청첩장', '신혼여행'].map((title, i) => ({ id: `item-${i}`, title, archived: false })),
    decisions: [], expenses: [], notes: [], comments: [], attachments: [],
    events: [{ id: 'wedding', title: '우리의 결혼식', date: '2027-09-25', time: '14:00', place: '', memo: '', itemId: '', votes: {}, revision: 1, done: false }],
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
function revised(record) { record.revision++; record.votes = {}; if ('done' in record) record.done = false; }
export function decisionComplete(state, id, seen = new Set()) {
  if (seen.has(id)) return false;
  seen.add(id);
  const d = state.decisions.find(x => x.id === id);
  return !!d && !d.archived && both(d.votes) && !!d.selectedId && state.decisions.filter(x => !x.archived && x.parentId === id).every(x => decisionComplete(state, x.id, seen));
}
export function budgetSummary(state) {
  const rows = state.settings.categories.map(category => {
    let paid = 0, committed = 0, estimated = 0;
    for (const e of state.expenses.filter(e => !e.archived && e.categoryId === category.id)) {
      paid += e.paid;
      if (both(e.votes)) committed += e.amount - e.paid;
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
  const state = JSON.parse(JSON.stringify(current));
  if (state.schema !== 1) fail('지원하지 않는 데이터 형식이에요.');
  const { type, payload: p = {} } = command;
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail('요청 내용을 확인해 주세요.');
  const { id, now } = meta;
  let message = '', target = 'timeline';
  switch (type) {
    case 'note.add':
      state.notes.unshift({ id, title: text(p.title), done: false, createdBy: actor, createdAt: now, itemId: '' }); message = '빠른 기록을 남겼어요.'; target = 'inbox'; break;
    case 'note.update': {
      const n = find(state.notes, p.id); n.title = text(p.title); n.done = bool(p.done);
      n.itemId = p.itemId ? find(state.items, p.itemId).id : ''; target = 'inbox'; break;
    }
    case 'note.archive': find(state.notes, p.id).archived = bool(p.archived); target = 'inbox'; break;
    case 'item.add': state.items.push({ id, title: text(p.title), archived: false }); target = 'decisions'; break;
    case 'item.update': {
      const item = find(state.items, p.id); item.title = text(p.title); item.archived = bool(p.archived); target = 'decisions'; break;
    }
    case 'decision.add': {
      const item = find(state.items, p.itemId);
      if (item.archived) fail('보관한 준비 항목에는 질문을 추가할 수 없어요.');
      if (p.parentId) {
        let parent = find(state.decisions, p.parentId), depth = 1;
        if (parent.itemId !== item.id || parent.archived) fail('상위 질문을 확인해 주세요.');
        while (parent.parentId) { parent = find(state.decisions, parent.parentId); if (++depth >= 20) fail('질문 깊이는 20단계까지 가능해요. 별도 질문으로 추가해 주세요.'); }
      }
      state.decisions.push({ id, itemId: item.id, parentId: p.parentId || '', title: text(p.title), options: [], selectedId: '', reason: '', revision: 1, votes: {}, archived: false });
      message = '함께 정할 질문을 추가했어요.'; target = 'decisions'; break;
    }
    case 'decision.update': {
      const d = find(state.decisions, p.id); d.title = text(p.title); d.archived = bool(p.archived); revised(d); target = 'decisions'; break;
    }
    case 'candidate.save': {
      const d = find(state.decisions, p.decisionId);
      if (d.archived) fail('보관한 질문은 먼저 복원해 주세요.');
      const option = { id: p.id ? find(d.options, p.id).id : id, title: text(p.title), detail: text(p.detail || '', 5000, true), quote: p.quote === null ? null : money(p.quote), link: p.link ? safeLink(p.link) : '', archived: p.id ? !!find(d.options, p.id).archived : false };
      if (p.id) d.options[d.options.findIndex(o => o.id === p.id)] = option; else d.options.push(option);
      revised(d); message = '후보를 수정했어요. 새 내용에 동의해 주세요.'; target = 'decisions'; break;
    }
    case 'candidate.archive': {
      const d = find(state.decisions, p.decisionId), option = find(d.options, p.id);
      option.archived = bool(p.archived); if (d.selectedId === option.id && option.archived) d.selectedId = '';
      revised(d); message = '후보 목록이 바뀌었어요. 다시 확인해 주세요.'; target = 'decisions'; break;
    }
    case 'decision.select': {
      const d = find(state.decisions, p.id); if (d.archived) fail('보관한 질문이에요.');
      const selected = find(d.options, p.optionId); if (selected.archived) fail('보관한 후보는 먼저 복원해 주세요.');
      d.selectedId = selected.id; d.reason = text(p.reason || '', 2000, true); revised(d);
      message = '후보를 제안했어요. 두 사람의 동의가 필요해요.'; target = 'decisions'; break;
    }
    case 'decision.vote': {
      const d = find(state.decisions, p.id); if (d.archived || !d.selectedId) fail('먼저 후보를 제안해 주세요.');
      if (p.revision !== d.revision) throw new DomainError('내용이 바뀌었어요. 다시 확인해 주세요.', 409);
      if (bool(p.agree)) d.votes[actor] = now; else delete d.votes[actor];
      message = both(d.votes) ? '두 사람이 같은 후보에 동의했어요.' : '동의 현황이 바뀌었어요.'; target = 'decisions'; break;
    }
    case 'event.save': {
      const old = p.id ? find(state.events, p.id) : null;
      const time = text(p.time || '', 5, true); if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail('시간을 확인해 주세요.');
      const day = date(p.date || ''); if (time && !day) fail('시간을 입력하려면 날짜를 먼저 정해 주세요.');
      const event = { id: old?.id || id, title: text(p.title), date: day, time, place: text(p.place || '', 300, true), memo: text(p.memo || '', 5000, true), itemId: p.itemId ? find(state.items, p.itemId).id : '', tasks: old?.tasks || [], revision: (old?.revision || 0) + 1, votes: {}, done: false, archived: false };
      if (old) state.events[state.events.indexOf(old)] = event; else state.events.push(event);
      message = '일정을 등록했어요. 내용을 확인하고 동의해 주세요.'; break;
    }
    case 'event.vote': {
      const e = find(state.events, p.id); if (e.archived) fail('보관한 일정이에요.');
      if (e.revision !== p.revision) throw new DomainError('일정이 바뀌었어요. 다시 확인해 주세요.', 409);
      if (bool(p.agree)) e.votes[actor] = now; else { delete e.votes[actor]; e.done = false; }
      message = both(e.votes) ? '일정에 두 사람이 동의했어요.' : '일정 동의 현황이 바뀌었어요.'; break;
    }
    case 'event.done': {
      const e = find(state.events, p.id); if (!both(e.votes) || e.archived) fail('두 사람이 동의한 일정만 완료할 수 있어요.'); e.done = bool(p.done); break;
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
      const amount = money(p.amount), paid = money(p.paid); if (paid > amount) fail('지급액은 총금액보다 클 수 없어요.');
      const categoryId = find(state.settings.categories, p.categoryId).id;
      const title = text(p.title), detail = text(p.detail || '', 2000, true);
      let source = null;
      if (p.decisionId) { const d = find(state.decisions, p.decisionId); if (!both(d.votes) || !d.selectedId || d.archived) fail('두 사람이 동의한 후보만 연결할 수 있어요.'); source = { decisionId: d.id, optionId: d.selectedId }; }
      if (source && state.expenses.some(e => !e.archived && e.id !== old?.id && e.source?.decisionId === source.decisionId)) fail('이미 지출로 기록한 결정이에요. 기존 항목을 수정해 주세요.');
      const materialChange = !old || old.title !== title || old.amount !== amount || old.categoryId !== categoryId || old.detail !== detail || JSON.stringify(old.source) !== JSON.stringify(source);
      const expense = { id: old?.id || id, title, amount, paid, detail, categoryId, source, revision: (old?.revision || 0) + (materialChange ? 1 : 0), votes: materialChange ? {} : old.votes, archived: false };
      if (old) state.expenses[state.expenses.indexOf(old)] = expense; else state.expenses.push(expense);
      message = '지출 기록을 갱신했어요.'; target = 'budget'; break;
    }
    case 'expense.vote': {
      const e = find(state.expenses, p.id); if (e.archived) fail('보관한 지출이에요.');
      if (e.revision !== p.revision) throw new DomainError('금액이나 조건이 바뀌었어요. 다시 확인해 주세요.', 409);
      if (bool(p.agree)) e.votes[actor] = now; else delete e.votes[actor];
      message = both(e.votes) ? '지출 금액에 두 사람이 동의했어요.' : '지출 동의 현황이 바뀌었어요.'; target = 'budget'; break;
    }
    case 'expense.archive': {
      const e = find(state.expenses, p.id); if (e.paid > 0 && p.archived) fail('지급 기록이 있는 항목은 보관할 수 없어요. 잘못된 지급액을 먼저 수정해 주세요.');
      e.archived = bool(p.archived); target = 'budget'; break;
    }
    case 'budget.propose': {
      const budget = money(p.budget), scope = text(p.scope, 200);
      if (!Array.isArray(p.categories) || !p.categories.length || p.categories.length > 30) fail('분류는 1~30개로 설정해 주세요.');
      const categories = p.categories.map((c, i) => ({ id: c.id ? find(state.settings.categories, c.id).id : `${id}-${i}`, title: text(c.title, 60), included: bool(c.included) }));
      if (new Set(categories.map(c => c.id)).size !== categories.length) fail('중복된 분류가 있어요.');
      if (state.expenses.some(e => !categories.some(c => c.id === e.categoryId))) fail('기록이 있는 분류는 삭제 대신 예산 포함을 해제해 주세요.');
      state.budgetProposal = { id, settings: { budget, scope, categories }, votes: { [actor]: now }, createdBy: actor };
      message = '예산 변경을 제안했어요. 상대방 동의 후 적용돼요.'; target = 'budget'; break;
    }
    case 'budget.vote': {
      const proposal = state.budgetProposal; if (!proposal || proposal.id !== p.id) throw new DomainError('예산 제안이 바뀌었어요. 다시 확인해 주세요.', 409);
      if (bool(p.agree)) proposal.votes[actor] = now; else delete proposal.votes[actor];
      if (both(proposal.votes)) { state.settings = proposal.settings; state.budgetProposal = null; message = '두 사람이 동의한 예산을 적용했어요.'; }
      target = 'budget'; break;
    }
    case 'budget.cancel': state.budgetProposal = null; target = 'budget'; break;
    case 'comment.add':
      targetExists(state, p.kind, p.targetId);
      state.comments.push({ id, kind: p.kind, targetId: p.targetId, body: text(p.body, 5000), author: actor, createdAt: now });
      message = '새 의견을 남겼어요.'; target = p.kind === 'expense' ? 'budget' : p.kind === 'event' ? 'timeline' : 'decisions'; break;
    case 'attachment.add':
      targetExists(state, p.kind, p.targetId);
      // Object metadata is provided exclusively by the authenticated upload endpoint.
      if (!meta.attachment && !p.url) fail('첨부 파일을 확인해 주세요.');
      state.attachments.push({ id, kind: p.kind, targetId: p.targetId, title: text(p.title), author: actor, createdAt: now,
        ...(p.url ? { url: safeLink(p.url) } : meta.attachment) }); target = 'decisions'; break;
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
