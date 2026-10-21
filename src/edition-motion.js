const ROLE_ART_IMAGE='__ROLE_ART_IMAGE__';
const EDITORIAL_IMAGE='__EDITORIAL_ART__';
function applyEditorialArt(){document.querySelectorAll('.poster-art,.handoff-art').forEach(el=>el.style.backgroundImage='url("'+EDITORIAL_IMAGE+'")');document.querySelectorAll('[data-role-art]').forEach(el=>el.style.backgroundImage='url("'+ROLE_ART_IMAGE+'")')}
const motionPrefs=window.matchMedia('(prefers-reduced-motion: reduce)');
const motionMemory={key:'',tab:null,mode:null,phase:null,counts:new Map(),dealId:null,shown:new Set(),flowKey:'',flowProgress:0,revealKey:''};
let sheetDismissAnimation=null;
function canMove(){return !motionPrefs.matches&&!document.hidden&&typeof Element.prototype.animate==='function'}
function inkAnimate(el){if(canMove()&&el)el.animate([{transform:'translateY(4px)',opacity:.4},{transform:'translateY(0)',opacity:1}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'})}
function enhanceMount(){
  applyEditorialArt();
  const key=state.screen,tab=state.tab,mode=state.mode,changed=key!==motionMemory.key;
  if(canMove()){
    if(changed){const groups=Array.from(document.querySelector('#view').children).slice(0,5);groups.forEach((el,i)=>el.animate([{transform:'translateY(12px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:300,delay:i*25,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}))}
    else if(key==='game'&&tab!==motionMemory.tab){const order=['flow','players','notes'],from=order.indexOf(motionMemory.tab),to=order.indexOf(tab),ink=document.querySelector('.tab-indicator');if(ink&&from>=0)ink.animate([{transform:`translateX(${from*100}%) skewX(-8deg)`},{transform:`translateX(${to*100}%) skewX(-8deg)`}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});const pane=document.querySelector('#game-pane');if(pane)pane.animate([{transform:`translateX(${to>from?10:-10}px)`,opacity:.45},{transform:'translateX(0)',opacity:1}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'})}
    else if(key==='config'&&mode!==motionMemory.mode){const modes=Object.keys(MODE_NAMES),ink=document.querySelector('.mode-ink'),from=modes.indexOf(motionMemory.mode),to=modes.indexOf(mode);if(ink&&from>=0)ink.animate([{transform:`translateX(${from*100}%) skewX(-6deg)`},{transform:`translateX(${to*100}%) skewX(-6deg)`}],{duration:260,easing:'cubic-bezier(.16,1,.3,1)'});inkAnimate(document.querySelector('.configuration'))}
    if(key==='game'&&state.game?.phase!==motionMemory.phase&&!changed)inkAnimate(document.querySelector('.phase-display'));
    if(key==='config')document.querySelectorAll('.count-input').forEach(input=>{const countKey=input.dataset.countInput+':'+input.dataset.id,old=motionMemory.counts.get(countKey);if(!changed&&mode===motionMemory.mode&&old!==undefined&&old!==input.value)input.animate([{transform:'translateY(-4px)',opacity:.3},{transform:'translateY(0)',opacity:1}],{duration:180,easing:'ease-out'});motionMemory.counts.set(countKey,input.value)});
  }
  if(key==='deal'){
    const gameId=state.game.createdAt||'old',fresh=gameId!==motionMemory.dealId;
    if(canMove())document.querySelectorAll('.deal-grid .seat').forEach((card,index)=>{const player=state.game.players[index];if(fresh)card.animate([{transform:'translateY(16px) rotate(-4deg)',opacity:0},{transform:'translateY(0) rotate(0)',opacity:1}],{duration:380,delay:Math.min(index*30,240),easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});else if(player.shown&&!motionMemory.shown.has(player.seat))card.animate([{transform:'scale(1.04)'},{transform:'scale(1)'}],{duration:220,easing:'ease-out'})});
    motionMemory.dealId=gameId;motionMemory.shown=new Set(state.game.players.filter(p=>p.shown).map(p=>p.seat));
  }
  if(key==='game'&&tab==='flow'){
    const progressKey=(state.game.createdAt||'old')+':'+state.game.phase,steps=getSteps(state.game),checked=state.game.notes[state.game.phase]?.checked||[],progress=steps.length?steps.filter(step=>checked.includes(step.id)).length/steps.length*100:0;
    if(canMove()&&progressKey===motionMemory.flowKey&&progress!==motionMemory.flowProgress){document.querySelector('.flow-meter>i')?.animate([{width:motionMemory.flowProgress+'%'},{width:progress+'%'}],{duration:330,easing:'cubic-bezier(.16,1,.3,1)'});inkAnimate(document.querySelector('.flow-progress b'))}
    motionMemory.flowKey=progressKey;motionMemory.flowProgress=progress;
  }
  if(canMove())document.querySelectorAll('.flow-row.just-recorded').forEach(el=>el.animate([{transform:'translateX(-5px)',opacity:.5},{transform:'translateX(0)',opacity:1}],{duration:260,easing:'cubic-bezier(.16,1,.3,1)'}));
  motionMemory.key=key;motionMemory.tab=tab;motionMemory.mode=mode;motionMemory.phase=state.game?.phase;
  const dock=document.querySelector('#dock');if(dock&&!document.body.classList.contains('keyboard-open'))document.documentElement.style.setProperty('--dock-height',Math.ceil(dock.getBoundingClientRect().height)+'px');
}
function animateSheetContent(oldTitle,title){if(oldTitle&&oldTitle!==title&&document.querySelector('#sheet')?.open)inkAnimate(document.querySelector('.sheet-body'))}
function cancelSheetDismiss(){if(sheetDismissAnimation){const animation=sheetDismissAnimation;sheetDismissAnimation=null;animation.cancel()}}
function dismissSheetAnimated(){
  const sheet=document.querySelector('#sheet');if(!sheet?.open||!canMove()){closeSheet();return}
  cancelSheetDismiss();const animation=sheet.animate([{transform:sheet.style.transform||'translateY(0)',opacity:1},{transform:'translateY(36px)',opacity:0}],{duration:140,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});sheetDismissAnimation=animation;
  animation.onfinish=()=>{if(sheetDismissAnimation===animation){sheetDismissAnimation=null;animation.cancel();closeSheet()}};
}
function animateReveal(phase){
  applyEditorialArt();
  const key=(revealContext?.targetSeat||'')+':'+phase;if(key===motionMemory.revealKey)return;motionMemory.revealKey=key;
  if(!canMove())return;const node=document.querySelector(phase==='cover'?'.handoff-card':'.identity-stack');if(!node)return;
  node.animate(phase==='cover'?[{transform:'translateY(15px)',opacity:.4},{transform:'translateY(0)',opacity:1}]:[{transform:'perspective(900px) rotateX(-9deg) translateY(12px)',opacity:.45},{transform:'perspective(900px) rotateX(0) translateY(0)',opacity:1}],{duration:360,easing:'cubic-bezier(.16,1,.3,1)'});
}
function animateCardSwap(boxes){
  if(!canMove()||boxes.length!==2)return;
  const cards=Array.from(document.querySelectorAll('#reveal .identity'));cards.forEach((card,i)=>{card.getAnimations().forEach(a=>a.cancel());const own=card.getBoundingClientRect(),before=boxes[1-i];card.animate([{transform:`translateY(${before.top-own.top}px) rotate(${i?3:-3}deg)`},{transform:'translateY(0) rotate(0)'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});});
}
function targetControl(target,actorSeat,kind,recordSeat,label,disabled=false,emptyLabel='空过'){
  const g=state.game,name=target?String(target).padStart(2,'0')+' 号':'未选择 / '+emptyLabel;
  if(disabled)return `<div class="field target-field"><span>${label}</span><div class="target-static">${target?name:emptyLabel}</div></div>`;
  return `<div class="field target-field"><span>${label}</span><details class="target-chooser" data-target-seat="${recordSeat||'team'}"><summary aria-label="${label}：${esc(name)}"><span>${target?'<b>'+String(target).padStart(2,'0')+'</b><small>号</small>':esc(name)}</span>${icon('next')}</summary><div class="target-options"><div class="target-number-grid">${g.players.filter(p=>playerStatus(g,p,actionContext.key).alive||String(p.seat)===String(target)).map(p=>{const denied=p.seat===actorSeat&&(kind==='inspect'||(kind==='save'&&(g.config.rules.witchSelf==='never'||(g.config.rules.witchSelf==='first'&&g.phase>firstNightIndex(g)))));return `<button class="${String(target)===String(p.seat)?'selected':''}" data-action="chooseTarget" data-seat="${recordSeat||''}" data-value="${p.seat}" ${denied?'disabled':''} aria-label="${p.seat}号${denied?'，不可选择':''}" aria-pressed="${String(target)===String(p.seat)}">${String(p.seat).padStart(2,'0')}</button>`}).join('')}</div><button class="target-empty ${!target?'selected':''}" data-action="chooseTarget" data-seat="${recordSeat||''}" data-value="" aria-pressed="${!target}">${emptyLabel}</button></div></details></div>`;
}
function chooseActionTarget(button,recordSeat,value){
  if(recordSeat)draftRecord(recordSeat).target=value;else actionDraft.target=value;
  const chooser=button.closest('.target-chooser'),summary=chooser?.querySelector('summary'),label=chooser?.closest('.target-field')?.firstElementChild.textContent||'行动目标';
  if(summary){summary.querySelector('span').innerHTML=value?'<b>'+String(value).padStart(2,'0')+'</b><small>号</small>':actionContext.id==='wolves'?'未选择 / 空刀':'未选择 / 空过';summary.setAttribute('aria-label',label+'：'+(value?value+' 号':actionContext.id==='wolves'?'空刀':'空过'));summary.focus({preventScroll:true})}
  chooser?.querySelectorAll('[data-action=chooseTarget]').forEach(option=>{const chosen=String(option.dataset.value)===String(value);option.classList.toggle('selected',chosen);option.setAttribute('aria-pressed',String(chosen))});
  if(chooser)chooser.open=false;
  const result=recordSeat?document.getElementById('record-result-'+recordSeat):document.getElementById('action-result');if(result){result.innerHTML=recordSeat?recordResultMarkup(recordSeat):actionResultMarkup();inkAnimate(result.firstElementChild)}
}
function installSheetDrag(){
  const sheet=document.getElementById('sheet');let gesture=null;
  sheet.addEventListener('pointerdown',event=>{if(event.target.closest('.sheet-head')&&!event.target.closest('button')){cancelSheetDismiss();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dy:0};sheet.setPointerCapture(event.pointerId)}});
  sheet.addEventListener('pointermove',event=>{if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(Math.abs(dx)>65){gesture=null;sheet.style.transform='';return}gesture.dy=Math.max(0,dy);if(dy>5){sheet.classList.add('is-dragging');sheet.style.transform=`translateY(${Math.max(0,dy)*.72}px)`}});
  const end=event=>{if(!gesture)return;const held=gesture;gesture=null;sheet.classList.remove('is-dragging');sheet.style.transform='';if(sheet.hasPointerCapture(held.id))sheet.releasePointerCapture(held.id);if(event.type!=='pointercancel'&&held.dy>100)requestCloseSheet();else if(canMove()&&held.dy>5)sheet.animate([{transform:`translateY(${held.dy*.72}px)`},{transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'})};
  sheet.addEventListener('pointerup',end);sheet.addEventListener('pointercancel',end);
}
document.addEventListener('pointerdown',event=>{
  const button=event.target.closest('button');if(!button||button.disabled||!canMove())return;
  const box=button.getBoundingClientRect(),wave=document.createElement('i'),size=Math.max(box.width,box.height)*1.8;wave.className='tap-burst';wave.setAttribute('aria-hidden','true');Object.assign(wave.style,{width:size+'px',height:size+'px',left:event.clientX-box.left-size/2+'px',top:event.clientY-box.top-size/2+'px'});button.append(wave);const animation=wave.animate([{transform:'scale(.05)',opacity:.18},{transform:'scale(1)',opacity:0}],{duration:460,easing:'ease-out'});animation.onfinish=()=>wave.remove();
},{passive:true});
if(typeof ResizeObserver!=='undefined')new ResizeObserver(entries=>{if(!document.body.classList.contains('keyboard-open'))document.documentElement.style.setProperty('--dock-height',Math.ceil(entries[0].contentRect.height+parseFloat(getComputedStyle(entries[0].target).paddingTop)+parseFloat(getComputedStyle(entries[0].target).paddingBottom)+2)+'px')}).observe(document.getElementById('dock'));
