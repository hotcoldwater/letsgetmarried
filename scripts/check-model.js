/* Run with Node, or evaluate after model.js in a JavaScript runtime. */
if(typeof require==='function')require('../model.js');
(function(){
 const M=WeddingModel;let count=0;
 function check(condition,message){if(!condition)throw new Error(message);count++;}
 function eq(actual,expected,message){check(actual===expected,message+': '+actual+' !== '+expected);}
 function throws(fn,message){let rejected=false;try{fn();}catch{rejected=true;}check(rejected,message);}
 const data=M.fresh(),before=JSON.stringify(data),normal=M.budgetSummary(data),over=M.budgetSummary(data,true);
 eq(normal.paid,8200000,'정상 지급 완료');eq(normal.committed,12600000,'정상 확정 미지급');eq(normal.estimated,7600000,'정상 미확정 예상');eq(normal.total,28400000,'정상 합계');eq(normal.remaining,1600000,'정상 남음');eq(normal.ratio.toFixed(1),'94.7','정상 비율');
 eq(over.paid,normal.paid,'시뮬레이션 지급 유지');eq(over.committed,normal.committed,'시뮬레이션 계약 유지');eq(over.estimated,11600000,'초과 예상액');eq(over.total,32400000,'초과 합계');eq(over.remaining,-2400000,'초과 금액');eq(over.rows[0].total,21500000,'예식장 합계 갱신');eq(over.ratio.toFixed(1),'108.0','초과 비율');
 eq(JSON.stringify(data),before,'시뮬레이션은 원본을 변경하지 않음');
 for(const summary of [normal,over]){for(const key of ['paid','committed','estimated','total'])eq(summary.rows.reduce((sum,row)=>sum+row[key],0),summary[key],'상세 표와 요약 일치 '+key);check(Math.abs(summary.widths.reduce((a,b)=>a+b,0)-summary.total/summary.scale*100)<1e-9,'막대의 세 구간은 지출 합계만 표현');eq(summary.target,summary.budget/summary.scale*100,'목표선의 실제 위치');check(summary.total<summary.scale,'초과 금액도 잘리지 않음');}
 check(normal.widths.reduce((a,b)=>a+b,0)<normal.target,'정상 막대가 목표선 이전');check(over.widths.reduce((a,b)=>a+b,0)>over.target,'초과 막대가 목표선 이후');eq(normal.scale,over.scale,'두 시뮬레이션의 같은 축 범위');
 const one=M.fresh();one.expenses=[{id:'contract',title:'계약 한 건',category:'스드메',amount:1000000,paid:0,confirmed:false}];eq(M.budgetSummary(one).estimated,1000000,'견적 단계');
 one.expenses[0].confirmed=true;one.expenses[0].paid=200000;let partial=M.budgetSummary(one);eq(partial.paid,200000,'부분 지급');eq(partial.committed,800000,'남은 계약금액');eq(partial.estimated,0,'확정 견적은 예상에서 제외');eq(partial.total,1000000,'계약금과 잔금 중복 없음');
 one.expenses[0].paid=1000000;eq(M.budgetSummary(one).committed,0,'전액 지급시 미지급 없음');eq(M.budgetSummary(one).total,1000000,'전액 지급 후 합계 유지');
 const expense={id:'zero',title:'확정된 0원',category:'기타 준비',amount:0,paid:0,confirmed:true};check(M.validateExpense(expense)===expense,'실제 0원 허용');
 for(const invalid of [{...expense,amount:null},{...expense,amount:NaN},{...expense,amount:-1},{...expense,amount:1.5},{...expense,paid:1},{...expense,amount:10,paid:1,confirmed:false},{...expense,title:''}])throws(()=>M.validateExpense(invalid),'잘못된 입력 거절');
 const bad=M.fresh();bad.settings.budget=0;throws(()=>M.validateData(bad),'0원 목표 거절');
 const roundTrip=JSON.parse(JSON.stringify(data));M.validateData(roundTrip);eq(M.budgetSummary(roundTrip).total,normal.total,'저장 후 재로딩 계산 유지');
 globalThis.LOCAL_CHECK_RESULT=count+' budget and persistence checks passed.';
 if(typeof console!=='undefined')console.log(LOCAL_CHECK_RESULT);
})();
