const approvedTheme='rose';
const state={view:'timeline',device:window.innerWidth<700?'mobile':'desktop',scenario:'normal',theme:approvedTheme};
const variants={timeline:'A',budget:'B'};
const $=id=>document.getElementById(id);
function render(){
  const focusedTheme=document.activeElement?.dataset?.theme;
  const theme=DESIGN_THEMES[state.theme];
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
  document.querySelectorAll('[data-device]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.device===state.device)));
  $('candidates').innerHTML=Object.entries(DESIGN_THEMES).map(([key,item])=>`<button type="button" class="candidate" data-theme="${key}" aria-pressed="${state.theme===key}"><span class="candidate-top"><span class="candidate-letter">${item.number}</span><span class="palette-swatches" aria-hidden="true"><i></i><i></i><i></i></span></span><strong>${item.name}</strong><p>${item.short}</p></button>`).join('');
  $('candidate-kicker').textContent=`PALETTE ${theme.number} / ${theme.english}`;
  $('preview-title').textContent=theme.name;
  $('preview-description').textContent=theme.description;
  $('choose').textContent=state.theme===approvedTheme?'✓ 확정한 색감':'확정한 로즈 블러시로 돌아가기';
  $('choose').classList.toggle('selected',state.theme===approvedTheme);
  $('choose').disabled=state.theme===approvedTheme;
  $('scenario-switch').hidden=state.view!=='budget';
  document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===state.scenario)));
  $('preview-stage').classList.toggle('is-mobile',state.device==='mobile');
  $('viewport-label').textContent=state.device==='mobile'?'IPHONE PREVIEW':'DESKTOP PREVIEW';
  $('review-details').innerHTML=`<div><span class="detail-label">이 색감의 분위기</span><p>${theme.good}</p></div><div><span class="detail-label">디자인할 때 지킬 점</span><p>${theme.watch}</p></div><div><span class="detail-label">배경 · 지급 완료 · 확정 미지급 · 미확정 예상</span><div class="color-codes">${theme.colors.map(c=>`<span>${c}</span>`).join('')}</div><p>타임라인 A · 예산 B · Pretendard 고정</p></div>`;
  $('chosen-theme').textContent=`${DESIGN_THEMES[approvedTheme].number} · ${DESIGN_THEMES[approvedTheme].name} · 확정`;
  $('prompt-theme').textContent=DESIGN_THEMES[approvedTheme].name+' · 확정';
  $('design-prompt').value=buildDesignPrompt(approvedTheme);
  sendPreview();
  if(focusedTheme)$('candidates').querySelector(`[data-theme="${focusedTheme}"]`)?.focus({preventScroll:true});
}
function sendPreview(){ $('preview').contentWindow?.postMessage({type:'wedding-preview',view:state.view,variant:variants[state.view],scenario:state.scenario,theme:state.theme},location.protocol==='file:'?'*':location.origin); }
$('preview').addEventListener('load',sendPreview);
window.addEventListener('message',event=>{
  if(event.source!==$('preview').contentWindow)return;
  if(location.protocol!=='file:'&&event.origin!==location.origin)return;
  if(event.data?.type==='wedding-preview-nav'&&['timeline','budget'].includes(event.data.view)){state.view=event.data.view;render();}
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.view){state.view=button.dataset.view;render();}
  if(button.dataset.theme&&Object.hasOwn(DESIGN_THEMES,button.dataset.theme)){state.theme=button.dataset.theme;$('prompt-feedback').textContent='';render();}
  if(button.dataset.device){state.device=button.dataset.device;render();}
  if(button.dataset.scenario){state.scenario=button.dataset.scenario;render();}
});
$('choose').addEventListener('click',()=>{
  state.theme=approvedTheme;
  $('selection-feedback').textContent='확정한 로즈 블러시 화면으로 돌아왔어요.';
  render();
});
$('copy-selection').addEventListener('click',async()=>{
  const text='결혼 준비 디자인 확정: 타임라인 A · 예산 B · 전체 Pretendard\n색감: 02 · 로즈 블러시';
  try{await navigator.clipboard.writeText(text);$('selection-feedback').textContent='복사했어요. 대화에 붙여 넣어 알려주세요.';}catch{$('selection-feedback').textContent=text.replaceAll('\n',' / ');}
});
$('copy-prompt').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(buildDesignPrompt(approvedTheme));$('prompt-feedback').textContent='확정한 로즈 블러시 프롬프트를 복사했어요.';}
  catch{document.querySelector('.prompt-section details').open=true;$('design-prompt').focus();$('design-prompt').select();$('prompt-feedback').textContent='프롬프트를 선택했어요. ⌘C 또는 Ctrl+C로 복사해 주세요.';}
});
render();
