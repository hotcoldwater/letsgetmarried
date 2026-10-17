/* Verify date boundaries and preservation of existing browser records. */
if (typeof require === 'function') require('../model.js');
(function () {
  const M = WeddingModel;
  let count = 0;
  function eq(actual, expected, message) {
    if (actual !== expected) throw new Error(message + ': ' + actual + ' !== ' + expected);
    count++;
  }
  function throws(fn, message) {
    let rejected = false;
    try { fn(); } catch { rejected = true; }
    eq(rejected, true, message);
  }
  const beforeMidnight = new Date('2027-09-24T14:59:59Z');
  const midnight = new Date('2027-09-24T15:00:00Z');
  eq(M.today(beforeMidnight), '2027-09-24', '한국 자정 직전');
  eq(M.today(midnight), '2027-09-25', '한국 자정');
  eq(M.countdown('2027-09-25', beforeMidnight), 'D−1', '예식 전날');
  eq(M.countdown('2027-09-25', midnight), 'D-Day', '예식 당일');
  eq(M.countdown('2027-09-25', new Date('2027-09-25T15:00:00Z')), 'D+1', '예식 다음 날');
  const legacy = M.fresh();
  legacy.version = 1;
  legacy.settings.weddingDate = '2027-04-17';
  legacy.settings.budget = 32000000;
  legacy.settings.scope = '사용자가 수정한 범위';
  legacy.notes.push({ id: 'custom-note', title: '보존할 기록', date: '2026-10-17', done: false });
  legacy.expenses[0].paid = 5500000;
  legacy.checklist[2] = true;
  legacy.comments.push({ decision: 'styling', text: '보존할 의견', date: '2026-10-17' });
  const original = JSON.stringify(legacy);
  const migrated = M.loadData(legacy);
  eq(migrated.version, 2, '이전 저장 형식 업그레이드');
  eq(migrated.settings.weddingDate, undefined, '오래된 예시 예식일 제거');
  eq(migrated.settings.budget, 32000000, '사용자 예산 유지');
  eq(migrated.settings.scope, legacy.settings.scope, '사용자 범위 유지');
  for (const field of ['notes', 'expenses', 'checklist', 'comments']) {
    eq(JSON.stringify(migrated[field]), JSON.stringify(legacy[field]), field + ' 보존');
  }
  eq(JSON.stringify(legacy), original, '원본 저장 데이터 변경 없음');
  eq(JSON.stringify(M.loadData(migrated)), JSON.stringify(migrated), '새 형식 재로드');
  const invalid = JSON.parse(original);
  invalid.expenses[0].paid = -1;
  throws(() => M.loadData(invalid), '이전 형식의 손상 데이터도 거절');
  throws(() => M.loadData({ ...migrated, version: 99 }), '알 수 없는 형식 거절');
  globalThis.WEDDING_CHECK_RESULT = count + ' wedding date and migration checks passed.';
  if (typeof console !== 'undefined') console.log(WEDDING_CHECK_RESULT);
})();
