/* Browser-independent data and budget rules for the local prototype. */
(function (root) {
  'use strict';
  const categories = ['예식장', '스드메', '예복 · 예물', '청첩장 · 답례품', '기타 준비'];
  const clone = value => JSON.parse(JSON.stringify(value));
  // Confirmed couple information is separate from browser-local sample records.
  const wedding = Object.freeze({
    groom: '오성현', bride: '정지윤', date: '2027-09-25', time: '14:00', timeZone: 'Asia/Seoul'
  });
  function today(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: wedding.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const value = type => parts.find(part => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  }
  function countdown(date = wedding.date, now = new Date()) {
    const remaining = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today(now) + 'T00:00:00Z')) / 86400000);
    return remaining === 0 ? 'D-Day' : remaining > 0 ? `D−${remaining}` : `D+${-remaining}`;
  }
  const seed = {
    version: 2,
    settings: { budget: 30000000, scope: '결혼 준비 · 결혼식' },
    expenses: [
      { id: 'venue-contract', title: '예식장 계약 · 대관과 식대', category: '예식장', amount: 15200000, paid: 5000000, confirmed: true },
      { id: 'venue-estimate', title: '추가 인원과 본식 옵션', category: '예식장', amount: 2300000, paid: 0, confirmed: false },
      { id: 'styling-contract', title: '스드메 계약', category: '스드메', amount: 4400000, paid: 2000000, confirmed: true },
      { id: 'styling-estimate', title: '촬영 추가 옵션', category: '스드메', amount: 1000000, paid: 0, confirmed: false },
      { id: 'rings-paid', title: '예복 예약 및 예물', category: '예복 · 예물', amount: 1000000, paid: 1000000, confirmed: true },
      { id: 'rings-estimate', title: '예복·예물 추가 예상 비용', category: '예복 · 예물', amount: 1500000, paid: 0, confirmed: false },
      { id: 'invitation-paid', title: '청첩장 준비 비용', category: '청첩장 · 답례품', amount: 200000, paid: 200000, confirmed: true },
      { id: 'invitation-estimate', title: '청첩장 인쇄와 답례품', category: '청첩장 · 답례품', amount: 1300000, paid: 0, confirmed: false },
      { id: 'other-estimate', title: '부케와 당일 준비', category: '기타 준비', amount: 1500000, paid: 0, confirmed: false }
    ],
    notes: [
      { id: 'note-1', title: '축가 부탁할 친구에게 예식일 먼저 알려주기', date: '2026-11-12', done: false },
      { id: 'note-2', title: '청첩장 봉투 리본 컬러 찾아보기', date: '2026-11-13', done: false }
    ],
    checklist: [true, true, false, false],
    comments: []
  };
  function validateExpense(expense) {
    if (!expense || typeof expense.title !== 'string' || !expense.title.trim() || expense.title.length > 120) throw new Error('항목 이름을 120자 이내로 입력해 주세요.');
    if (!categories.includes(expense.category)) throw new Error('준비 항목을 선택해 주세요.');
    for (const key of ['amount', 'paid']) {
      if (!Number.isSafeInteger(expense[key]) || expense[key] < 0 || expense[key] > 10000000000) throw new Error('금액은 0원부터 100억 원까지 정수로 입력해 주세요.');
    }
    if (typeof expense.confirmed !== 'boolean') throw new Error('지출 상태를 확인해 주세요.');
    if (expense.paid > expense.amount) throw new Error('지급액은 총금액보다 클 수 없어요.');
    if (!expense.confirmed && expense.paid !== 0) throw new Error('지급 내역이 있으면 확정된 비용으로 기록해 주세요.');
    return expense;
  }
  function budgetSummary(data, simulateOver = false) {
    const rows = categories.map(name => ({ name, paid: 0, committed: 0, estimated: 0, total: 0 }));
    for (const expense of data.expenses) {
      validateExpense(expense);
      const row = rows.find(row => row.name === expense.category);
      row.paid += expense.paid;
      row.committed += expense.confirmed ? expense.amount - expense.paid : 0;
      row.estimated += expense.confirmed ? 0 : expense.amount;
    }
    if (simulateOver) rows[0].estimated += 4000000;
    const result = { budget: data.settings.budget, rows, paid: 0, committed: 0, estimated: 0 };
    for (const row of rows) {
      row.total = row.paid + row.committed + row.estimated;
      for (const key of ['paid', 'committed', 'estimated']) result[key] += row[key];
    }
    result.total = result.paid + result.committed + result.estimated;
    result.remaining = result.budget - result.total;
    result.ratio = result.total / result.budget * 100;
    const largest = Math.max(result.budget, result.total);
    const step = largest <= 10000000 ? 1000000 : 5000000;
    result.scale = Math.ceil(largest * 1.05 / step) * step;
    result.widths = ['paid', 'committed', 'estimated'].map(key => result[key] / result.scale * 100);
    result.target = result.budget / result.scale * 100;
    return result;
  }
  function validateData(data) {
    if (!data || data.version !== 2 || !data.settings || !Number.isSafeInteger(data.settings.budget) || data.settings.budget <= 0 || data.settings.budget > 10000000000) throw new Error('저장한 예산을 읽을 수 없어요.');
    if (typeof data.settings.scope !== 'string' || data.settings.scope.length > 80) throw new Error('저장한 설정을 읽을 수 없어요.');
    if (!Array.isArray(data.expenses) || data.expenses.length > 1000) throw new Error('저장한 지출을 읽을 수 없어요.');
    data.expenses.forEach(validateExpense);
    if (!Array.isArray(data.notes) || data.notes.length > 500 || data.notes.some(n => !n || typeof n.id !== 'string' || typeof n.title !== 'string' || n.title.length > 200 || typeof n.done !== 'boolean' || typeof n.date !== 'string')) throw new Error('저장한 기록을 읽을 수 없어요.');
    if (!Array.isArray(data.checklist) || data.checklist.length !== 4 || data.checklist.some(v => typeof v !== 'boolean')) throw new Error('체크리스트를 읽을 수 없어요.');
    if (!Array.isArray(data.comments) || data.comments.length > 500 || data.comments.some(c => !c || typeof c.text !== 'string' || c.text.length > 1000 || typeof c.decision !== 'string' || typeof c.date !== 'string')) throw new Error('저장한 의견을 읽을 수 없어요.');
    return data;
  }
  function loadData(stored) {
    const data = clone(stored);
    if (data && data.version === 1 && data.settings?.weddingDate === '2027-04-17') {
      data.version = 2;
      delete data.settings.weddingDate;
    }
    return validateData(data);
  }
  root.WeddingModel = { categories, wedding, today, countdown, fresh: () => clone(seed), loadData, validateExpense, validateData, budgetSummary };
})(globalThis);
