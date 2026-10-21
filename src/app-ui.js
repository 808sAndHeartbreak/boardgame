const STORE_KEY='boardgame-identity-dispenser-v2';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={
  back:'<path d="m14 5-7 7 7 7"/>',
  next:'<path d="m9 5 7 7-7 7"/>',
  add:'<path d="M12 5v14M5 12h14"/>',
  cards:'<rect x="7" y="5" width="12" height="16" rx="2"/><path d="M5 17H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10"/><path d="m10 12 3-3 3 3-3 3z"/>',
  wolf:'<path d="m4 3 5 5h6l5-5-1 12-7 6-7-6z"/><path d="m7 12 3 1m7-1-3 1m-4 4h4"/>',
  shield:'<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5z"/><path d="M12 6v11M8 10h8"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  potion:'<path d="M9 3h6m-5 0v6L4 18c-1 2 0 3 2 3h12c2 0 3-1 2-3l-6-9V3M7 15h10"/><path d="m10 17 1 1m3-1h1"/>',
  crosshair:'<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6M9 12h6m-3-3v6"/>',
  person:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3M8 22v-5m8 5v-5"/>',
  spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  pencil:'<path d="m4 16 12-12 4 4L8 20H4zM13 7l4 4M4 16l4 4"/>',
  moon:'<path d="M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15Z"/><path d="m17 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
  sun:'<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  mask:'<path d="m3 5 9 3 9-3-2 12-7 4-7-4z"/><path d="m6 10 4 2-4 1m12-3-4 2 4 1m-8 4h4"/>',
  check:'<path d="m5 12 4 4L20 5"/>',
  full:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>'
};
function icon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">'+(icons[name]||icons.next)+'</svg>'}
function initialState(){return {screen:'home',mode:'standard',configs:{standard:makeConfig('standard'),dual:makeConfig('dual'),confidence:makeConfig('confidence')},game:null,tab:'flow',noteTab:'timeline',filter:'all',configRulesOpen:false}}
function load(){
  try{const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');if(saved?.configs)return {...initialState(),...saved}}
  catch{}
  const fresh=initialState();
  try{
    const old=JSON.parse(localStorage.getItem('boardgame-identity-dispenser-v1')||'null');
    if(old?.game?.players){
      const idByName=Object.fromEntries(Object.entries(ROLE_BANK).map(([id,r])=>[r.name,id]));
      const counts={};old.game.players.forEach(p=>{const id=idByName[p.role]||'villager';counts[id]=(counts[id]||0)+1});
      const c=makeConfig('standard');c.players=old.game.players.length;c.roles=Object.entries(counts).map(([id,count])=>({id,count,...clone(ROLE_BANK[id])}));
      c.rules.witchSelf=old.witchRule==='禁止'?'never':old.witchRule==='始终允许'?'always':'first';fresh.configs.standard=c;
      const notes={};Object.entries(old.game.notes||{}).forEach(([key,value])=>{const [n,phase]=key.split('-'),idx=(Number(n)-1)*2+(phase==='day'?1:0);notes[idx]={text:[value.death?'实际死亡 / 出局：'+value.death:'',value.info||'',value.memo||''].filter(Boolean).join('\n'),checked:[]}});
      const phase=(old.game.round-1)*2+(old.phase==='day'?1:0);
      fresh.game={mode:'standard',config:clone(c),players:old.game.players.map(p=>({seat:p.seat,cards:[idByName[p.role]||'villager'],original:[idByName[p.role]||'villager'],shown:p.shown,locked:old.screen==='game'})),phase,maxPhase:phase,actions:{},notes,roleNotes:{},playerNotes:old.game.roleNotes||{},events:[],started:old.screen==='game'};
    }
  }catch{}
  return fresh;
}
let state=load(),roleDraft=null,actionDraft=null,actionContext=null,revealContext=null,deathContext=null,toastTimer=null,confirmTask=null,saveTimer=null;
for(const [mode,c] of Object.entries(state.configs))c.rules={...makeConfig(mode).rules,...c.rules};
if(state.game)state.game.config.rules={...makeConfig(state.game.mode).rules,...state.game.config.rules};
if(!state.schema||state.schema<4){
  const c=state.configs.dual,wolf=c.roles.find(r=>r.id==='wolf');
  if(!c.roles.some(r=>r.id==='hiddenwolf')&&wolf?.count){wolf.count--;c.roles.splice(c.roles.indexOf(wolf)+1,0,{id:'hiddenwolf',count:1,...clone(ROLE_BANK.hiddenwolf)})}
  state.noteTab='timeline';state.schema=4;
}
if(state.schema!==5){
  const c=state.configs.dual;
  if(c.rules.king==='none')c.rules.king='finish';
  const oldDefault=c.players===7&&c.roles.length===7&&c.roles.every(r=>r.count===({villager:7,wolf:2,hiddenwolf:1,seer:1,witch:1,hunter:1,knight:1}[r.id]||0));
  if(oldDefault){c.roles.find(r=>r.id==='wolf').count=1;c.roles.push({id:'whitewolfking',count:1,...clone(ROLE_BANK.whitewolfking)})}
  if(state.game?.mode==='confidence'&&state.game.started&&state.game.phase===0){state.game.phase=1;state.game.maxPhase=Math.max(1,state.game.maxPhase)}
  state.schema=5;
}
fixedDualRules(state.configs.dual);
if(state.game?.mode==='dual')fixedDualRules(state.game.config);
let saveState='saved',toastTask=null,sheetGuard=null,pendingGuard=null,sheetBack=null,roleBaseline='',actionBaseline='';
let activeViewKey='',restoringView=false;
const sheetPositions=new Map();
function rememberSheet(){const key=$('sheet').dataset.positionKey;if(key)sheetPositions.set(key,$('sheet-content').querySelector('.sheet-body')?.scrollTop||0)}
const viewPositions=state.uiPositions||(state.uiPositions={});
function viewKey(){const g=state.game;return state.screen==='game'?[g?.createdAt||'old','game',g?.phase,state.tab,state.tab==='notes'?state.noteTab:''].join(':'):state.screen+':'+state.mode}
function rememberView(){if(activeViewKey&&!restoringView)viewPositions[activeViewKey]=Math.round(window.scrollY)}
function mountView(){
  if(!document.body.classList.contains('keyboard-open'))document.documentElement.style.setProperty('--dock-height',Math.ceil($('dock').getBoundingClientRect().height)+'px');
  const key=viewKey(),top=viewPositions[key]||0;activeViewKey=key;restoringView=true;
  requestAnimationFrame(()=>{window.scrollTo({top,behavior:'instant'});requestAnimationFrame(()=>restoringView=false)});
  updateSaveStatus();enhanceMount();
}
function saveLabel(){return `<span class="save-label" data-save-indicator>${saveState==='pending'?'待保存':saveState==='error'?'保存失败':'已保存'}</span>`}
function updateSaveStatus(){
  document.querySelectorAll('[data-save-indicator]').forEach(el=>{el.textContent=saveState==='pending'?'待保存':saveState==='error'?'保存失败':'已保存';el.dataset.status=saveState});
  const alert=$('storage-alert');if(alert){alert.hidden=saveState!=='error';alert.innerHTML='<span>保存失败，记录暂留在当前页面</span><button data-action="retrySave">重试保存</button>'}
  document.querySelectorAll('[data-save-alert]').forEach(el=>el.hidden=saveState!=='error');
}
function save(){clearTimeout(saveTimer);try{localStorage.setItem(STORE_KEY,JSON.stringify(state));saveState='saved';updateSaveStatus();return true}catch{saveState='error';updateSaveStatus();return false}}
function queueSave(){clearTimeout(saveTimer);saveState='pending';updateSaveStatus();saveTimer=setTimeout(save,180)}
function clearToast(){clearTimeout(toastTimer);toastTask=null;$('toast').classList.remove('show','has-action');$('toast').textContent=''}
function toast(message,options={}){
  clearToast();if($('sheet').open&&!options.action){const box=$('sheet-feedback');if(box){box.textContent=message;box.hidden=false;box.classList.toggle('is-success',!!options.success);toastTimer=setTimeout(()=>{if(box.isConnected)box.hidden=true},2600);return}}
  $('toast').innerHTML=`<i class="toast-mark" aria-hidden="true">${icon('spark')}</i><span>${esc(message)}</span>${options.action?`<button data-action="toastAction">${esc(options.label||'撤销')}</button>`:''}`;
  toastTask=options.action||null;$('toast').classList.toggle('has-action',!!toastTask);$('toast').classList.add('show');toastTimer=setTimeout(clearToast,toastTask?5500:2100);
}
function setScreen(screen){rememberView();clearToast();state.screen=screen;save();render()}
function goBack(){if(state.screen==='deal'){state.mode=state.game.mode;setScreen('config')}else setScreen('home')}
function offerSheetBack(callback,label='返回'){sheetBack=callback;const h=$('sheet-content').querySelector('.sheet-head');if(h&&!h.querySelector('.sheet-back'))h.insertAdjacentHTML('afterbegin',`<button class="sheet-back" data-action="sheetBack" aria-label="${esc(label)}">${icon('back')}</button>`)}
function protectSheet(dirty,render){sheetGuard={dirty,render}}
function requestCloseSheet(destination){
  if(!destination&&$('sheet').dataset.returnPlayer){const seat=Number($('sheet').dataset.returnPlayer);delete $('sheet').dataset.returnPlayer;openPlayer(seat);return}
  if(pendingGuard){dismissDraft(false);return}
  if(sheetGuard?.dirty()){
    pendingGuard={...sheetGuard,destination:destination||null,scroll:$('sheet-content').querySelector('.sheet-body')?.scrollTop||0};sheetGuard=null;
    openSheet('放弃未保存的修改？','','<div class="button-row"><button class="secondary" data-action="resumeDraft">继续编辑</button><button class="primary" data-action="discardDraft">放弃修改</button></div>');return;
  }
  if(destination)destination();else dismissSheetAnimated();
}
function dismissDraft(discard){const held=pendingGuard;pendingGuard=null;if(!held)return;if(discard){if(held.destination)held.destination();else closeSheet()}else{held.render();$('sheet-content').querySelector('.sheet-body').scrollTop=held.scroll||0}}
function requestRedeal(){const g=state.game;askConfirm('重新发牌？','本局身份和记录将被替换。','重新发牌',()=>{state.game=createGame(g.config,g.mode);state.mode=g.mode;save();renderDeal();toast('已重新发牌')})}

function config(){const c=state.configs[state.mode];return state.mode==='dual'?fixedDualRules(c):c}

function stepper(kind,value,id,min=0,max=48){
  const name=kind==='players'?'人数':(config().roles.find(r=>r.id===id)?.name||'身份')+'数量';
  return `<div class="stepper"><button type="button" data-action="count" data-kind="${kind}" data-id="${id||''}" data-delta="-1" aria-label="减少${name}" ${value<=min?'disabled':''}>−</button><input class="count-input" aria-label="${kind==='players'?'玩家人数':(config().roles.find(r=>r.id===id)?.name||'身份')+'数量'}" type="number" inputmode="numeric" min="${min}" max="${max}" data-count-input="${kind}" data-id="${id||''}" value="${value}"><button type="button" data-action="count" data-kind="${kind}" data-id="${id||''}" data-delta="1" aria-label="增加${name}" ${value>=max?'disabled':''}>＋</button></div>`;
}

function render(){
  document.body.dataset.screen=state.screen;
  if((state.screen==='deal'||state.screen==='game')&&!state.game)state.screen='home';
  header();
  if(state.screen==='home')renderHome();
  if(state.screen==='config')renderConfig();
  if(state.screen==='deal')renderDeal();
  if(state.screen==='game')renderGame();
}
function header(){
  if(state.screen==='home'){$('app-header').innerHTML=`<div class="brand"><span class="brand-icon" aria-hidden="true">${icon('mask')}</span>桌游身份发放</div>`;return}
  const title=state.screen==='config'?'身份配置':state.screen==='deal'?'身份发放':'';
  $('app-header').innerHTML=`<div class="navhead"><button class="icon-button" data-action="back" aria-label="返回">${icon('back')}</button>${title?`<span>${title}</span>`:''}</div><div class="header-tools">${state.screen==='game'?'<button class="top-button" data-action="phaseMenu">阶段</button>':''}<button class="top-button" data-action="rules">规则</button></div>`;
}
function renderHome(){
  const g=state.game;
  $('view').innerHTML=`${g?`<button class="resume resume-main" data-action="resume"><span class="resume-symbol" aria-hidden="true">${icon(g.started?'moon':'cards')}</span><span class="resume-copy"><small>继续本局</small><strong>${MODE_NAMES[g.mode]}<small>${g.players.length} 人 · ${g.started?phaseName(g.phase)+(isHistory(g)?' · 回看':''):'发牌中'}</small></strong></span><span class="resume-arrow">${icon('next')}</span></button>`:''}<section class="game-poster" aria-label="狼人杀"><div class="poster-heading"><span class="poster-art" aria-hidden="true"></span><h1>狼人杀</h1></div><nav class="poster-modes" aria-label="选择狼人杀玩法">${Object.entries(MODE_NAMES).map(([id,name])=>`<button data-action="quickMode" data-value="${id}"><strong>${name}</strong><span class="mode-meta"><small>${state.configs[id].players} 人</small><i aria-hidden="true">${icon('next')}</i></span></button>`).join('')}</nav></section><button class="game-choice unavailable" disabled><strong>阿瓦隆</strong><span class="pending">待开发</span></button>`;
  $('dock').innerHTML='';mountView();
}
function renderConfig(){
  const c=config(),mode=state.mode,total=countCards(c),expected=c.players*(mode==='dual'?2:1),errors=validateConfig(c,mode),counts={civil:0,wolf:0,god:0};
  c.roles.forEach(r=>counts[r.camp]=(counts[r.camp]||0)+r.count);
  const presets=mode==='dual'?[5,6,7,8]:mode==='standard'?[9,12]:[9];
  $('view').innerHTML=`<h1 class="sr-only">配置身份</h1><nav class="segmented" aria-label="狼人杀模式" style="--mode-index:${Object.keys(MODE_NAMES).indexOf(mode)}"><i class="mode-ink" aria-hidden="true"></i>${Object.entries(MODE_NAMES).map(([id,name])=>`<button class="${mode===id?'active':''}" aria-pressed="${mode===id}" data-action="mode" data-value="${id}">${name}</button>`).join('')}</nav>
  <section class="people-section"><div class="people-row"><h2>玩家人数</h2>${stepper('players',c.players,'',3,24)}</div><div class="presets">${presets.map(n=>`<button class="preset ${c.players===n?'active':''}" data-action="preset" data-value="${n}">${n} 人</button>`).join('')}<button class="inline-button" data-action="resetConfig">重置</button></div></section>
  <section class="section configuration"><div class="config-total ${total!==expected?'incomplete':''}"><div><h2>身份牌</h2><span>民 ${counts.civil} · 狼 ${counts.wolf} · 神 ${counts.god}</span></div><strong>${total}<small> / ${expected} 张</small></strong></div><div class="role-rows">${c.roles.map(r=>`<div class="role-row"><button class="role-edit" data-action="editRole" data-id="${r.id}"><span class="config-role-mark" aria-hidden="true">${roleSeal(r.id,r.camp)}</span><span class="role-edit-copy"><span class="role-name-label">${esc(r.name)}<i class="edit-glyph" aria-hidden="true">${icon('pencil')}</i></span></span></button>${stepper('role',r.count,r.id)}</div>`).join('')}</div><button class="add-role" data-action="addRoleMenu">${icon('add')}添加身份</button></section>
  <section class="section settings-section"><details id="config-rules" class="settings" ${state.configRulesOpen?'open':''}><summary>${mode==='confidence'?'自信狼规则':'开局桌规'}</summary>${renderSettings(c,mode)}</details></section>`;
  $('dock').innerHTML=`<div class="dock-hint error" role="status" ${errors.length?'':'hidden'}>${esc(errors[0]||'')}</div><button class="primary" data-action="deal" ${errors.length?'disabled':''}>生成身份 ${icon('next')}</button>`;mountView();
}

function ruleSelect(key,label,options){
  const value=config().rules[key];
  return `<div class="setting-row"><label for="rule-${key}">${label}</label><select id="rule-${key}" data-rule="${key}">${options.map(([id,name])=>`<option value="${id}" ${value===id?'selected':''}>${name}</option>`).join('')}</select></div>`;
}
function ruleToggle(key,label){return `<div class="setting-row"><label for="rule-${key}">${label}</label><input type="checkbox" id="rule-${key}" data-rule="${key}" ${config().rules[key]?'checked':''}></div>`}
function ruleRange(label,minKey,maxKey){
  const rules=config().rules;
  return `<div class="setting-row"><label>${label}</label><span class="range-inputs"><input aria-label="${label}下限" type="number" min="0" max="24" data-rule="${minKey}" value="${rules[minKey]}">–<input aria-label="${label}上限" type="number" min="0" max="24" data-rule="${maxKey}" value="${rules[maxKey]}"></span></div>`;
}
function renderSettings(c,mode){
  let html='';
  if(mode==='dual'){
    html+=ruleToggle('forbidWolfSeer','预言家不与狼牌同手');
    html+=ruleSelect('order','上下身份顺序',[['player','玩家确认时选择'],['deal','按发牌顺序锁定']]);
    html+=ruleSelect('king','金刚狼额外规则',[['none','无额外技能'],['finish','完杀一次'],['checkGood','上牌查为好人']]);
    html+='<div class="brief">至少一位双民金宝宝 · 预言家查验顶层身份<br>好人清空全部狼牌获胜；狼人清空金宝宝获胜。</div>';
  }
  if(mode==='confidence'){
    html+=`<div class="brief"><ol><li>看下家底牌，号码 +1，末位看 1 号。</li><li>跳过首夜；第一天两轮发言后放逐投票。</li><li>无警长；睁错眼暴毙，无遗言。</li><li>查验真实底牌；无狼睁眼为空刀。</li><li>已睁眼的狼可自爆；天亮只报出局者。</li></ol></div>`;

  }else html+=ruleToggle('sheriff','警长竞选');
  html+=ruleSelect('witchSelf','女巫自救',[['first',mode==='confidence'?'仅首个实际夜晚':'仅首夜允许'],['never','全程禁止'],['always','全程允许']]);
  if(c.roles.some(r=>r.id==='guard'&&r.count))html+=ruleSelect('guardSave','同守同救',[['die','仍然倒牌'],['live','免于狼刀']]);
  return html;
}
function setPreset(n){
  const old=clone(config()),next=makeConfig(state.mode,n),mode=state.mode;
  next.roles=next.roles.map(r=>{const found=old.roles.find(x=>x.id===r.id);return found?{...found,count:r.count}:r});
  state.configs[mode]=next;save();renderConfig();toast('已应用 '+n+' 人配置',{action:()=>{state.configs[mode]=old;save();renderConfig();toast('已恢复原配置')}});
}

function startDeal(){
  const generate=()=>{try{state.game=createGame(config(),state.mode);state.tab="flow";state.dealTab="seats";state.filter="all";state.journalPhase='all';state.noteSeat=1;state.noteQuery='';state.journalKind='all';state.journalFolds={};setScreen("deal")}catch(e){toast(e.message)}};
  if(state.game)askConfirm("重新生成身份？","当前本局的身份和记录将被替换。","重新生成",generate);else generate();
}
function nextRecipient(){
  const g=state.game;
  for(let recipient=1;recipient<=g.players.length;recipient++){const target=revealTarget(g.mode,recipient,g.players.length);if(!g.players[target-1].shown)return recipient}
  return null;
}
function renderDeal(){
  const g=state.game,count=g.players.filter(p=>p.shown).length,n=g.players.length,next=nextRecipient(),showPlayers=state.dealTab==='players';
  document.body.dataset.dealTab=showPlayers?'players':'seats';
  $('view').innerHTML=`<div class="deal-head"><div><h1>${MODE_NAMES[g.mode]}</h1><p class="hint-line">${n} 人 · ${g.mode==='dual'?'每人两张':'每人一张'}</p></div><div class="deal-progress" role="progressbar" aria-label="身份展示进度" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${count}" style="--shown:${count/n}"><strong>${count}<small>/${n}</small></strong><span>已展示</span></div></div>${g.mode==='confidence'?`<div class="hint-band confidence-map"><strong>查看下家</strong><span>2 号看 3 号 · ${n} 号看 1 号</span></div>`:''}<div class="deal-tools"><button class="secondary" data-action="editAllocation">调整身份</button><button class="text-action" data-action="redeal">重新发牌</button></div><nav class="deal-tabs" aria-label="身份视图"><button class="${showPlayers?'':'active'}" data-action="dealTab" data-value="seats" aria-pressed="${!showPlayers}">发放</button><button class="${showPlayers?'active':''}" data-action="dealTab" data-value="players" aria-pressed="${showPlayers}">玩家</button></nav>${showPlayers?playersMarkup():`<div class="seat-grid deal-grid">${g.players.map(p=>{const recipient=revealRecipient(g.mode,p.seat,n);return `<button class="seat ${p.shown?'done':''}" data-action="reveal" data-seat="${p.seat}" aria-label="号码牌${p.seat}，给${recipient}号查看"><span class="seat-number">${String(p.seat).padStart(2,'0')}</span><span class="seat-footer">${g.mode==='confidence'?'给 '+recipient+' 号看':p.shown?'已展示':'未展示'}</span></button>`}).join('')}</div>`}`;
  $('dock').innerHTML=`<div class="button-row deal-actions">${next?'<button class="secondary" data-action="revealNext">逐位展示</button>':''}<button class="primary ${count<n?'unconfirmed':''}" data-action="startGame" aria-label="${count<n?'开始游戏，尚有未展示玩家，需要确认':'开始游戏'}">开始游戏 ${icon('next')}</button></div>`;mountView();
}

function showReveal(targetSeat){
  const g=state.game;
  revealContext={targetSeat,recipient:revealRecipient(g.mode,targetSeat,g.players.length),phase:'cover'};
  closeSheet();renderReveal();if(!$('reveal').open)$('reveal').showModal();$('reveal').querySelector('[data-action=uncover]')?.focus({preventScroll:true});syncModalState();
}
function renderReveal(){
  const g=state.game,c=revealContext;
  if(c?.announcement){
    $('reveal').innerHTML=`<div class="reveal-inner"><div class="reveal-head"><span>天亮了</span><button data-action="closeReveal" aria-label="关闭">×</button></div><div class="reveal-body announcement"><p class="reveal-eyebrow">${c.seats.length?'昨夜出局':'平安夜'}</p><div class="announce-seats">${c.seats.length?c.seats.map(n=>n+' 号').join('、'):'无人出局'}</div></div><div class="reveal-footer"><button class="primary" data-action="closeReveal">收起</button></div></div>`;return;
  }
  const p=g.players[c.targetSeat-1],roles=roleMap(g.config),info=handInfo(p.cards,roles),num=n=>String(n).padStart(2,'0');
  let body,buttons;
  if(c.phase==='cover'){
    body=`<div class="handoff-card"><p class="reveal-eyebrow">交给这位玩家</p><div class="handoff-number"><span>${num(c.recipient)}</span><small>号</small></div><div class="handoff-art" aria-hidden="true"></div></div>`;
    buttons=`<button class="primary" data-action="uncover">${g.mode==='confidence'?'查看 '+num(p.seat)+' 号底牌':'查看身份'}${icon('next')}</button>`;
  }else{
    const canSwap=g.mode==='dual'&&g.config.rules.order==='player'&&!p.locked&&!p.original.includes('copy');
    const next=state.screen==='deal'?Array.from({length:g.players.length},(_,i)=>i+1).find(recipient=>{const target=revealTarget(g.mode,recipient,g.players.length);return target!==p.seat&&!g.players[target-1].shown}):null;
    body=`<div class="identity-owner">${g.mode==='confidence'?`<div class="seat-pair"><div><span>查看者</span><strong>${num(c.recipient)}<small>号</small></strong></div><i>→</i><div><span>底牌归属</span><strong>${num(p.seat)}<small>号</small></strong></div></div>`:`<div class="owner-sticker"><span>玩家</span><strong>${num(p.seat)}<small>号</small></strong></div>`}${g.mode!=='confidence'?`<div class="owner-context"><strong>${info.wolf?'狼人阵营':'好人阵营'}</strong>${info.gold?'<b>金宝宝</b>':info.doubleWolf?'<b>金刚狼</b>':''}</div>`:''}</div>
<div class="identity-stack">${p.cards.map((id,i)=>{const r=roles[id],copy=p.original[i]==='copy';return `<article class="identity ${p.cards.length===1?'single':''} ${i===0?'upper':'lower'}"><div class="identity-strip"><small>${g.mode==='dual'?(i===0?'上身份':'下身份'):g.mode==='confidence'?num(p.seat)+' 号底牌':'你的身份'}${copy?' · 复刻':''}</small></div><div class="identity-title-row"><strong>${esc(r.name)}</strong>${roleArtwork(id,r.camp)}</div><details class="identity-skill" ${p.cards.length===1?'open':''}><summary>技能</summary><p>${esc(r.skill)}</p></details></article>`}).join('')}</div>
    `;
    buttons=`${canSwap?'<button class="secondary" data-action="swapCards">交换上下身份</button>':''}<button class="primary" data-action="confirmReveal" data-next="${next?'yes':'no'}">${next?'遮住，交给 '+num(next)+' 号':'已看完，收起'}${icon('next')}</button>`;
  }
  $('reveal').innerHTML=`<div class="reveal-inner"><div class="reveal-head"><span>身份展示</span><div class="reveal-tools">${c.phase!=='cover'?'<button class="mask-identity" data-action="coverReveal">遮住</button>':''}<button data-action="fullscreen" aria-label="全屏">${icon('full')}</button><button data-action="closeReveal" aria-label="关闭">×</button></div></div><div class="reveal-body ${c.phase==='cover'?'is-cover':'is-identity'}">${body}</div><div class="reveal-footer">${buttons}</div></div>`;
  if($('reveal').open)$('reveal').querySelector(c.phase==='cover'?'[data-action=uncover]':'[data-action=coverReveal]')?.focus({preventScroll:true});
  animateReveal(c.phase);
}
function roleSeal(id,camp){
  const glyph={seer:'eye',witch:'potion',hunter:'crosshair',idiot:'spark',guard:'shield',villager:'person',wolf:'wolf',hiddenwolf:'wolf',wolfking:'wolf',whitewolfking:'wolf',wolfbeauty:'wolf',copy:'cards'}[id]||(camp==='wolf'?'wolf':camp==='civil'?'person':'spark');
  return icon(glyph);
}

function roleArtwork(id,camp){
  const positions={wolf:[0,0],hiddenwolf:[0,0],wolfking:[0,0],whitewolfking:[0,0],wolfbeauty:[0,0],seer:[50,0],witch:[100,0],hunter:[0,100],villager:[50,100],idiot:[100,100]},pos=positions[id];
  return pos?`<span class="role-seal art-seal" data-role-art style="background-position:${pos[0]}% ${pos[1]}%" aria-hidden="true"></span>`:`<span class="role-seal" aria-hidden="true">${roleSeal(id,camp)}</span>`;
}
function closeReveal(){
  if($('reveal').open)$('reveal').close();revealContext=null;syncModalState();
  if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  render();
}
function confirmReveal(goNext=false){
  const g=state.game,p=g.players[revealContext.targetSeat-1];p.shown=true;p.locked=true;save();
  const next=goNext?nextRecipient():null;
  if(next){revealContext={targetSeat:revealTarget(g.mode,next,g.players.length),recipient:next,phase:'cover'};renderReveal()}else closeReveal();
}
function openSheet(title,body,footer=''){
  cancelSheetDismiss();
  const focused=$('sheet').contains(document.activeElement)?document.activeElement:null,focusAction=focused?.dataset.action,focusSeat=focused?.dataset.seat,focusValue=focused?.dataset.value,focusId=focused?.dataset.id,focusSlot=focused?.dataset.slot;
  const oldTitle=$('sheet').dataset.title;if(oldTitle!==title){sheetGuard=null;sheetBack=null;delete $('sheet').dataset.returnPlayer}
  const scroll=$('sheet-content').querySelector('.sheet-body')?.scrollTop||0;
  rememberSheet();
  const positionKey=[state.screen,state.game?.createdAt||state.mode,state.screen==='config'?state.mode:state.game?.phase,title,title==='身份与技能'?roleDraft?.id:''].join(':');
  const restore=sheetPositions.get(positionKey)||0;$('sheet').dataset.positionKey=positionKey;
  $('sheet').dataset.title=title;
  $('sheet-content').innerHTML=`<div class="sheet-frame"><header class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button class="sheet-close" data-action="closeSheet" aria-label="关闭">×</button></header><div class="sheet-body">${body}</div><footer class="sheet-actions ${footer?'':'feedback-only'}"><p id="sheet-feedback" class="sheet-feedback" role="alert" hidden></p><p data-save-alert class="sheet-feedback" role="alert" ${saveState==='error'?'':'hidden'}>保存失败，记录暂留在当前页面</p>${footer}</footer></div>`;
  if(!$('sheet').open){$('sheet').showModal();$('sheet').querySelector('.sheet-close').focus({preventScroll:true});$('sheet').querySelector('.sheet-body').scrollTop=restore}
  else $('sheet').querySelector('.sheet-body').scrollTop=oldTitle===title?scroll:restore;
  if((oldTitle===title||focusAction==='adjacentPlayer')&&focusAction){const match=Array.from($('sheet-content').querySelectorAll('button[data-action]')).find(b=>b.dataset.action===focusAction&&b.dataset.seat===focusSeat&&b.dataset.value===focusValue&&b.dataset.id===focusId&&b.dataset.slot===focusSlot);match?.focus({preventScroll:true})}
  if($('sheet').open&&!$('sheet').contains(document.activeElement))$('sheet-content').querySelector('.sheet-close')?.focus({preventScroll:true});
  syncModalState();updateSaveStatus();animateSheetContent(oldTitle,title);
}
function closeSheet(){delete $('sheet').dataset.returnPlayer;cancelSheetDismiss();rememberSheet();sheetGuard=null;sheetBack=null;pendingGuard=null;if($('sheet').open)$('sheet').close();confirmTask=null;syncModalState()}
function askConfirm(title,message,label,callback){
  confirmTask=callback;
  openSheet(title,`<p class="confirm-copy">${esc(message)}</p>`,`<div class="button-row"><button class="secondary" data-action="closeSheet">取消</button><button class="primary" data-action="confirmTask">${esc(label)}</button></div>`);
}

function editRole(id){
  roleBaseline='';roleDraft=clone(config().roles.find(r=>r.id===id));
  renderRoleEditor();
}
function renderRoleEditor(){
  const r=roleDraft;
  if(r.id.startsWith('custom'))r.effect='text';
  openSheet('身份与技能',`<label class="field"><span>身份名称</span><input data-role-edit="name" value="${esc(r.name)}" maxlength="12" autocomplete="off"></label><div class="field-pair"><label class="field"><span>类型</span><select data-role-edit="camp">${[['civil','平民'],['wolf','狼人'],['god','神职']].map(([id,name])=>`<option value="${id}" ${r.camp===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="field"><span>数量</span><input type="number" inputmode="numeric" min="0" max="48" data-role-edit="count" value="${r.count}"></label></div><label class="field"><span>技能</span><textarea data-role-edit="skill">${esc(r.skill)}</textarea></label><details class="editor-advanced"><summary>夜间行动</summary><div class="field-pair"><label class="field"><span>出现时机</span><select data-role-edit="night">${[['none','无夜间环节'],['first','首夜确认'],['every','每夜行动'],['team','随狼队行动']].map(([id,name])=>`<option value="${id}" ${r.night===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="field"><span>顺序 · 小号优先</span><input type="number" inputmode="numeric" min="-10" max="99" data-role-edit="order" value="${r.order}"></label></div>${r.id.startsWith('custom')?`<label class="field"><span>自定义记录提示</span><input data-role-edit="recordLabel" value="${esc(r.recordLabel||'')}" placeholder="例如：技能目标、结果" maxlength="30"></label>`:`<label class="field"><span>记录方式</span><select data-role-edit="effect">${[['text','自定义输入'],['target','选择行动目标'],['inspect','查验身份'],['medicine','记录解药 / 毒药'],['status','确认身份 / 状态']].map(([id,name])=>`<option value="${id}" ${roleEffect(r)===id?'selected':''}>${name}</option>`).join('')}</select></label>`}</details>`,`<div class="button-row"><button class="secondary danger" data-action="removeRole">移除</button><button class="primary" data-action="saveRole">保存</button></div>`);
  if(!roleBaseline)roleBaseline=JSON.stringify(roleDraft);protectSheet(()=>JSON.stringify(roleDraft)!==roleBaseline,renderRoleEditor);
}
function addRoleMenu(){
  openSheet('添加身份',`<div class="role-options">${Object.entries(ROLE_BANK).filter(([id])=>state.mode==='dual'||!['copy','hiddenwolf'].includes(id)).map(([id,r])=>`<button data-action="addRole" data-id="${id}" ${config().roles.some(x=>x.id===id)?'disabled':''}>${esc(r.name)}</button>`).join('')}</div>`,'<button class="secondary full-width" data-action="customRole">自定义身份</button>');
}
function saveRole(){
  if(!roleDraft.name.trim()){toast('请填写身份名称');return}
  if(!Number.isInteger(roleDraft.count)||roleDraft.count<0||roleDraft.count>48){toast('身份数量须为 0–48');return}
  if(roleDraft.night==='team'&&roleDraft.camp!=='wolf'){toast('只有狼人类型可设为随狼队行动');return}
  roleDraft.name=roleDraft.name.trim();roleDraft.skill=roleDraft.skill.trim()||'按本局开局约定执行。';roleDraft.order=Number.isFinite(roleDraft.order)?Math.max(-10,Math.min(99,roleDraft.order)):50;
  const i=config().roles.findIndex(r=>r.id===roleDraft.id);if(i>=0)config().roles[i]=clone(roleDraft);else config().roles.push(clone(roleDraft));
  save();closeSheet();renderConfig();
}

function phaseNote(){const g=state.game;if(!g.notes[g.phase])g.notes[g.phase]={text:'',checked:[]};return g.notes[g.phase]}
function isDone(id){return phaseNote().checked.includes(id)}
function toggleDone(id,value){
  const note=phaseNote(),done=value??!note.checked.includes(id);
  recentStep=id;
  note.checked=done?Array.from(new Set(note.checked.concat([id]))):note.checked.filter(x=>x!==id);
  save();
}
const visitedScenes=new Set();
let recentStep=null;
function renderGame(){
  const g=state.game,alive=g.players.filter(p=>playerStatus(g,p).alive).length,history=isHistory(g),day=g.phase%2===1;
  document.body.dataset.screen='game';document.body.dataset.period=day?'day':'night';document.body.dataset.gameTab=state.tab;
  $('view').classList.toggle('scene-first',!visitedScenes.has('game'));visitedScenes.add('game');
  $('view').innerHTML=`<section class="phase-banner ${day?'day':'night'}" aria-label="${phaseName(g.phase)}"><div class="phase-meta"><span>${MODE_NAMES[g.mode]}</span>${history?'<span class="history-stamp">历史阶段</span>':'<span class="live-stamp">进行中</span>'}</div><div class="phase-display"><h1 class="phase-title" aria-label="${phaseName(g.phase)}"><span class="phase-prefix">第</span><b>${String(Math.floor(g.phase/2)+1).padStart(2,'0')}</b><span class="period-sticker">${day?'天':'夜'}</span></h1><div class="alive-counter"><span>在场</span><strong>${String(alive).padStart(2,'0')}<small>/${String(g.players.length).padStart(2,'0')}</small></strong></div></div></section>
  <nav class="tabs" style="--tab-index:${['flow','players','notes'].indexOf(state.tab)}" aria-label="游戏导航"><i class="tab-indicator" aria-hidden="true"></i>${[['flow','流程'],['players','玩家'],['notes','笔记']].map(([id,name])=>`<button class="${state.tab===id?'active':''}" data-action="gameTab" data-value="${id}" aria-pressed="${state.tab===id}">${name}</button>`).join('')}</nav><div id="game-pane">${state.tab==='flow'?flowMarkup():state.tab==='players'?playersMarkup():notesMarkup()}</div>`;
  const action=history?'latestPhase':'advance';
  $('dock').innerHTML=`${history?'<div class="dock-hint">历史阶段 · 行动仅供查看</div>':''}<div class="button-row host-actions">${!history?`<button class="secondary" data-action="gameTab" data-value="players">玩家状态</button>`:''}<button class="primary" data-action="${action}">${history?'回到最新阶段':'进入'+phaseName(g.phase+1)}${icon('next')}</button></div>`;
  if(state.tab==='notes')$('dock').innerHTML=`<div class="note-dock-context">${phaseName(g.phase)}</div><button class="primary" data-action="editPhaseNote" data-phase="${g.phase}">写笔记 ${icon('add')}</button>`;
  if(state.tab==='players')$('dock').innerHTML='';
  recentStep=null;mountView();
}

function openPhaseMenu(){
  const g=state.game;
  openSheet('游戏阶段',`<div class="phase-menu">${Array.from({length:g.maxPhase+1},(_,i)=>i).filter(i=>g.mode!=='confidence'||i>0).map(i=>`<button class="${i===g.phase?'selected':''}" data-action="viewPhase" data-phase="${i}"><span>${phaseName(i)}</span><small>${i===g.phase?'正在查看':i===g.maxPhase?'最新阶段':''}</small>${i===g.phase?icon('check'):icon('next')}</button>`).reverse().join('')}</div>`);
}
function actionSummary(step){
  const g=state.game,a=g.actions[g.phase+':'+step.id];
  if(!a){if(g.mode!=='confidence'&&g.phase%2===0&&(step.action||step.id==='gold'||roleMap(g.config)[step.id])){const actors=stepActors(step.id);return actors.length?actors.map(n=>n+' 号').join('、')+(step.id==='gold'?' · 互认':''):'无对应玩家'}return step.hint}
  if(a.id==='wolves')return (a.emptyKnife?'空刀 · ':g.mode==='confidence'&&g.phase===0?'首夜无刀 · ':'')+(a.actors.length?a.actors.map(n=>n+'号').join('、')+(g.mode==='confidence'?'睁眼':'行动'):(g.mode==='confidence'?'无人睁眼':'无可行动玩家'))+(a.target?' → '+a.target+'号':'');
  const records=actionRecords(g,a,g.phase+':'+a.id);
  return records.map(r=>r.seat+'号'+(r.potion==='save'?'解药':r.potion==='poison'?'毒药':'')+(r.target?' → '+r.target+'号':'')+(r.result?' · '+r.result:'')+(r.info?' · '+r.info:'')).join('；')|| (g.mode==='confidence'?'无正确睁眼者':'无可行动玩家');
}
const DEATH_NAMES={idiotFlip:'白痴翻牌',wolf:'狼刀',poison:'中毒',vote:'放逐',shot:'猎枪',explode:'自爆',whiteblast:'白狼王带人',miswake:'睁错眼',duel:'决斗',finish:'完杀',other:'其他'};
function eventMarkup(e){
  const g=state.game,p=g.players.find(p=>p.seat===e.seat),roles=roleMap(g.config);
  const cardNames=(e.reason==='idiotFlip'?[e.cardSlot]:e.slots).map(i=>roles[p.cards[i]]?.name||'身份').join('、');
  const action='restoreEvent',id=e.id;
  return `<div class="event"><div><strong>${e.seat} 号 · ${e.reason==='idiotFlip'?'翻牌留场':g.mode==='dual'?'倒牌':'出局'}</strong><p>${esc(cardNames)} · ${DEATH_NAMES[e.reason]||'其他'}${e.noLastWords?' · 无遗言':e.reason==='idiotFlip'?' · 不可投票':''}</p></div><button data-action="${action}" data-id="${id}" ${isHistory(g)?'disabled':''}>恢复</button></div>`;
}

function flowMarkup(){
  const g=state.game,note=phaseNote(),steps=getSteps(g),events=g.events.filter(e=>e.phase===g.phase),done=steps.filter(s=>isDone(s.id)).length,firstPending=steps.find(s=>!isDone(s.id))?.id;
  return `<section class="flow-section">${g.mode==='confidence'&&g.phase===0?'<div class="hint-band">首夜无刀 · 正确睁眼才可使用技能</div>':''}${g.mode==='confidence'&&g.phase%2&&g.phase>1?'<button class="secondary announcement-button" data-action="announce">公布昨夜出局名单</button>':''}<div class="section-head flow-heading"><h2>${g.phase%2?'白天流程':'夜晚行动'}</h2><span class="flow-progress" aria-label="已完成 ${done} 项，共 ${steps.length} 项"><b>${done}</b> / ${steps.length}</span></div><div class="flow-meter" aria-hidden="true"><i style="width:${steps.length?done/steps.length*100:0}%"></i></div><div class="flow-list">${steps.map((step,index)=>`<div class="flow-row ${isDone(step.id)?'complete':''} ${step.id===firstPending?'current':''} ${recentStep===step.id?'just-recorded':''}"><button class="check-button ${isDone(step.id)?'done':''}" data-action="checkStep" data-id="${step.id}" aria-label="${isDone(step.id)?'取消':'标记'}${esc(step.name)}完成" ${isHistory(g)?'disabled':''}><span>${isDone(step.id)?'✓':String(index+1).padStart(2,'0')}</span></button><button class="flow-open" data-action="openStep" data-id="${step.id}"><span><span class="flow-name">${esc(step.name)}</span><span class="flow-note">${esc(actionSummary(step))}</span></span><span class="chevron">${icon('next')}</span></button></div>`).join('')}</div></section>
  <div class="record-bar"><h2>${g.mode==='dual'?'倒牌':'出局'}记录</h2></div><div class="event-list">${events.length?events.map(eventMarkup).join(''):'<p class="empty">暂无记录</p>'}</div>
  <label class="field phase-note-field"><span>${g.phase%2?'白天笔记':'夜晚笔记'}${saveLabel()}</span><textarea data-phase-note placeholder="输入本阶段的信息">${esc(note.text)}</textarea></label>`;
}

function playersMarkup(){
  const g=state.game,roles=roleMap(g.config),dual=g.mode==='dual',alive=g.players.filter(p=>playerStatus(g,p).alive).length;
  if(!['all','alive','dead'].includes(state.filter)){state.playerRole=state.filter;state.filter='all'}
  const filter=state.filter||'all',role=roles[state.playerRole]?state.playerRole:'all';
  const shown=g.players.filter(p=>(filter==='all'||(filter==='alive'?playerStatus(g,p).alive:!playerStatus(g,p).alive))&&(role==='all'||p.cards.includes(role)));
  return `<div class="roster-summary"><span>${g.started?phaseName(g.phase):MODE_NAMES[g.mode]+' · '+g.players.length+' 人'}</span><span>在场 <b>${alive}</b> · 出局 <b>${g.players.length-alive}</b>${allocationEditable()?'<button class="text-action" data-action="editAllocation">调配</button>':''}</span></div><div class="roster-filters"><div class="roster-status" aria-label="玩家状态">${[['all','全部'],['alive','在场'],['dead','出局']].map(([id,name])=>`<button class="${filter===id?'active':''}" data-action="playerFilter" data-value="${id}" aria-pressed="${filter===id}">${name}</button>`).join('')}</div><select data-player-role aria-label="玩家身份筛选"><option value="all">全部身份</option>${g.config.roles.filter(r=>r.count).map(r=>`<option value="${r.id}" ${role===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div><div class="seat-grid roster-grid ${dual?'dual-roster':''}">${shown.map(p=>{
    const st=playerStatus(g,p),info=handInfo(p.cards,roles),tag=info.gold?'金宝宝':info.doubleWolf?'金刚狼':!st.alive?'出局':!st.canVote?'禁票':'';
    return `<button class="seat roster-seat ${st.alive?'':'dead'} ${st.active===1?'second-card':''}" data-action="player" data-seat="${p.seat}" aria-label="${p.seat}号，${p.cards.map((id,i)=>(dual?(i?'下身份':'上身份'):'')+roles[id].name+(st.lost.has(i)?'已倒牌':'')).join('，')}，${st.alive?'在场':'已出局'}"><span class="roster-seat-head"><span class="seat-number">${String(p.seat).padStart(2,'0')}</span>${tag?`<span class="roster-tag ${!st.alive?'out':''}">${tag}</span>`:''}</span>${dual?`<span class="roster-camp">${info.wolf?'狼人阵营':'好人阵营'}</span>`:''}<span class="roster-watermark" aria-hidden="true">${roleSeal(p.cards[st.active]||p.cards[0],roles[p.cards[st.active]||p.cards[0]].camp)}</span><span class="roster-hand">${p.cards.map((id,i)=>`<span class="roster-role ${st.lost.has(i)?'is-lost':st.active===i?'is-active':''}">${dual?`<small>${i?'下':'上'}</small>`:''}<strong>${esc(roles[id].name)}</strong>${st.lost.has(i)?'<i aria-hidden="true">×</i>':dual&&st.active===i?'<i class="roster-active" aria-label="生效中"></i>':''}</span>`).join('')}</span></button>`;
  }).join('')}</div>${!shown.length?'<div class="roster-empty"><p>没有符合条件的玩家</p><button class="text-action" data-action="resetPlayerFilter">清除筛选</button></div>':''}`;
}
function actionLines(g,a,key,filter={}){
  const roles=roleMap(g.config),seatText=seats=>seats.map(n=>n+' 号').join('、'),lines=[];
  const role=roles[a.id],records=actionRecords(g,a,key);
  if(a.id==='wolves'){
    if(filter.role&&roles[filter.role]?.camp!=='wolf')return [];
    if(filter.seat&&!a.actors.includes(filter.seat)&&Number(a.target)!==filter.seat)return [];
    const action=a.phase===0&&g.mode==='confidence'?'首夜无刀':a.emptyKnife?'空刀':a.target?'刀口 → '+a.target+' 号':'空刀';
    lines.push({title:'狼人 · '+action,detail:seatText(a.actors)+(g.mode==='confidence'?' 睁眼':' 行动'),kind:'action'});
  }else{
    if(filter.role&&filter.role!==a.id)return [];
    for(const r of records){
      if(filter.seat&&r.seat!==filter.seat&&Number(r.target)!==filter.seat)continue;
      const effect=roleEffect(role),verb=r.potion==='save'?'解药':r.potion==='poison'?'毒药':effect==='inspect'?'查验':effect==='medicine'?'未用药':effect==='status'?'确认':'行动';
      const label=(role?.name||'身份')+' · '+r.seat+' 号 '+verb+(r.target?' → '+r.target+' 号':'')+(r.result?' · '+r.result:'');
      lines.push({title:label,detail:r.info||'',kind:'action'});
    }
    if(!records.length&&!filter.seat)lines.push({title:(role?.name||'身份')+' · '+(g.mode==='confidence'?'无人正确睁眼':'无可行动玩家'),detail:'',kind:'action'});
  }
  if(a.info&&lines.length)lines.push({title:'行动备注',detail:a.info,kind:'memo'});
  return lines;
}
const journalIndex=new Map();
function journalNotePhase(){return state.game.phase}
function noteNeedle(){const q=(state.noteQuery||'').trim(),m=q.match(/^0*(\d{1,2})(?:\s*号)?$/);return m?String(Number(m[1])):q}
function noteMatch(text){const q=noteNeedle().toLocaleLowerCase();if(!q)return true;if(/^\d{1,2}$/.test(q)){const source=String(text).replace(/第\s*\d+\s*[天夜]/g,'');return new RegExp('(^|[^0-9])0?'+q+'(?![0-9])').test(source)}return String(text).toLocaleLowerCase().includes(q)}
function marked(text){
  const s=String(text??''),q=noteNeedle();if(!q)return esc(s);let out='',offset=0,at;
  if(/^\d{1,2}$/.test(q)){const re=new RegExp('(^|[^0-9])(0?'+q+')(?![0-9])','g');let m;while((m=re.exec(s))){const i=m.index+m[1].length;out+=esc(s.slice(offset,i))+'<mark>'+esc(m[2])+'</mark>';offset=i+m[2].length}return out+esc(s.slice(offset))}
  const lower=s.toLocaleLowerCase(),needle=q.toLocaleLowerCase();while((at=lower.indexOf(needle,offset))>=0){out+=esc(s.slice(offset,at))+'<mark>'+esc(s.slice(at,at+q.length))+'</mark>';offset=at+q.length}return out+esc(s.slice(offset));
}
function notesMarkup(){
  state.noteQuery='';state.noteTab='timeline';
  return `<section class="journal journal-v2 journal-all"><h1 class="sr-only">全部记录</h1><div id="journal-results">${journalResults()}</div></section>`;
}
function journalResults(){
  const g=state.game,roles=roleMap(g.config),tab='timeline',filter={},kind='all',phaseFilter='all',query='';
  journalIndex.clear();let groups=[],total=0;
  for(let phase=g.maxPhase;phase>=0;phase--){
    if(phaseFilter!=='all'&&Number(phaseFilter)!==phase)continue;let lines=[];
    for(const [key,a] of Object.entries(g.actions).filter(([key])=>Number(key.split(':')[0])===phase)){
      const rows=actionLines(g,a,key,filter),entryId='action:'+key;
      if(rows.length){const detail=rows.map(r=>[r.title,r.detail].filter(Boolean).join('\n')).join('\n\n');journalIndex.set(entryId,{phase,title:(roles[a.id]?.name||'狼人')+' · 行动记录',detail,actionId:a.id});lines.push({key:entryId,title:rows[0].title,detail:[rows[0].detail,...rows.slice(1).map(r=>r.kind==='memo'?r.detail:[r.title,r.detail].filter(Boolean).join('：'))].filter(Boolean).join('\n'),kind:'action',time:a.recordedAt||0})}
    }
    for(const e of g.events.filter(e=>e.phase===phase)){
      const p=g.players[e.seat-1],slots=e.reason==='idiotFlip'?[e.cardSlot]:e.slots;if(filter.seat&&filter.seat!==e.seat)continue;if(filter.role&&!slots.some(i=>p.cards[i]===filter.role))continue;
      const title=e.seat+' 号 · '+(e.reason==='idiotFlip'?'翻牌留场 · ':'')+(DEATH_NAMES[e.reason]||'其他'),detail=slots.map(i=>(g.mode==='dual'?(i?'下身份 ':'上身份 '):'')+(roles[p.cards[i]]?.name||'身份')).join('、')+(e.noLastWords?' · 无遗言':''),key='event:'+e.id;
      journalIndex.set(key,{phase,title,detail,eventId:e.id});lines.push({key,title,detail,kind:'death',time:e.recordedAt||1});
    }
    lines.sort((a,b)=>a.time-b.time);
    const note=g.notes[phase];
    if(!filter.role&&!filter.seat){
      const simple=(note?.checked||[]).filter(id=>!g.actions[phase+':'+id]).map(id=>({order:'核对上下身份',gold:'金宝宝互认',sheriff:'警长竞选',debate:'发言与放逐',talk:'依次发言',talk1:'第一轮发言',talk2:'第二轮发言',vote:'放逐投票',skills:'技能结算'}[id]||roles[id]?.name||id));
      if(simple.length)lines.push({title:'已完成 · '+simple.join('、'),detail:'',kind:'action'});
      if(note?.text)lines.push({title:'阶段笔记',detail:note.text,kind:'memo',notePhase:phase});
    }
    lines=lines.filter(line=>(kind==='all'||line.kind===kind)&&noteMatch(phaseName(phase)+' '+line.title+' '+line.detail));
    if(!lines.length)continue;
    total+=lines.length;
    const counts={action:0,death:0,memo:0};lines.forEach(line=>counts[line.kind]++);
    const folded=false,summary=Object.entries(counts).filter(([,n])=>n).map(([k,n])=>n+({action:' 行动',death:g.mode==='dual'?' 倒牌':' 出局',memo:' 笔记'}[k])).join(' · ');
    groups.push(`<section class="journal-phase"><div class="journal-phase-head"><h2>${phaseName(phase)}${phase===g.maxPhase?'<b class="current-badge">当前</b>':''}</h2><button class="journal-edit" data-action="editPhaseNote" data-phase="${phase}" aria-label="编辑${phaseName(phase)}笔记">${icon('pencil')}</button></div>${folded?'':`<div class="journal-lines">${lines.map(line=>`<article class="journal-entry ${line.kind}">${line.key?`<button class="journal-entry-open" data-action="journalEntry" data-id="${esc(line.key)}"><span class="entry-kind">${line.kind==='death'?(g.mode==='dual'?'倒牌':'出局'):'行动'}</span><span><strong>${marked(line.title)}</strong>${line.detail?`<p class="note-copy">${marked(line.detail)}</p>`:''}</span><span class="entry-arrow">›</span></button>`:line.notePhase!==undefined?`<button class="journal-entry-open memo-open" data-action="editPhaseNote" data-phase="${line.notePhase}"><span class="memo-content"><p class="note-copy">${marked(line.detail)}</p></span><span class="entry-arrow">›</span></button>`:`<div class="journal-entry-text"><span class="entry-kind">${line.kind==='memo'?'笔记':'流程'}</span><span><strong>${marked(line.title)}</strong>${line.detail?`<p class="note-copy">${marked(line.detail)}</p>`:''}${line.notePhase!==undefined?`<button class="text-action" data-action="editPhaseNote" data-phase="${line.notePhase}">编辑</button>`:''}</span></div>`}</article>`).join('')}</div>`}</section>`);
  }
  if((kind==='all'||kind==='memo')&&(phaseFilter==='all'||filter.role||filter.seat)){
    const extra=[];
    for(const [id,text] of Object.entries(g.roleNotes)){if(!text||filter.seat||filter.role&&id!==filter.role||!noteMatch((roles[id]?.name||'')+' '+text))continue;extra.push({title:(roles[id]?.name||'身份')+' · 身份笔记',text,action:'editRoleNote',id})}
    for(const [seat,text] of Object.entries(g.playerNotes)){if(!text||filter.role||filter.seat&&Number(seat)!==filter.seat||!noteMatch(seat+' 号 '+text))continue;extra.push({title:seat+' 号 · 玩家笔记',text,action:'editPlayerNote',seat})}
    if(extra.length){total+=extra.length;groups.push(`<section class="journal-extras">${extra.map(n=>`<article class="standalone-note"><button class="journal-entry-open extra-note" data-action="${n.action}" ${n.id?`data-id="${n.id}"`:`data-seat="${n.seat}"`}><span class="memo-content"><strong>${marked(n.title)}</strong><p class="note-copy">${marked(n.text)}</p></span><span class="entry-arrow">›</span></button></article>`).join('')}</section>`)}
  }
  return groups.join('')||'<div class="journal-empty"><strong>还没有记录</strong></div>';
}
function refreshJournal(){const box=$('journal-results');if(box)box.innerHTML=journalResults();const clear=$('view').querySelector('.search-clear');if(clear)clear.hidden=!(state.noteQuery||'')}
function openJournalEntry(key){
  const e=journalIndex.get(key);if(!e)return;
  openSheet(phaseName(e.phase),`<h3 class="entry-detail-title">${esc(e.title)}</h3><p class="note-copy entry-detail-copy">${esc(e.detail)}</p>`,`<button class="primary" data-action="closeSheet">返回记录</button>`);
}
function editNote(kind,key){
  const g=state.game;if(kind==='phase'&&!g.notes[key])g.notes[key]={text:'',checked:[]};
  const title=kind==='phase'?phaseName(Number(key))+' · 笔记':kind==='role'?roleMap(g.config)[key].name+' · 笔记':key+' 号 · 笔记',value=kind==='phase'?g.notes[key].text:kind==='role'?g.roleNotes[key]||'':g.playerNotes[key]||'';
  openSheet(title,`<label class="field"><span>${saveLabel()}</span><textarea class="note-editor" data-note-kind="${kind}" data-note-key="${key}" placeholder="输入记录">${esc(value)}</textarea></label>`,'<button class="primary" data-action="closeNote">完成</button>');
}

function allocationEditable(){const g=state.game;return !g.events.length&&!Object.keys(g.actions).length&&!Object.values(g.notes).some(n=>n.checked?.length)}
let allocationDraft=null,allocationSelection=null,allocationChanges=[];
function allocationErrors(){
  const g=state.game,roles=roleMap(g.config),hands=allocationDraft.map(p=>p.original);
  if(g.mode==='dual'&&hands.some(h=>h[0]==='copy'))return ['复刻牌须放在下身份'];
  if(g.mode==='dual'&&!validHands(hands,roles,g.config.rules))return [g.config.rules.forbidWolfSeer&&hands.some(h=>{const i=handInfo(h,roles);return i.wolf&&i.seer})?'预言家不能与狼牌同手':'至少保留一位双民金宝宝'];
  return [];
}
function editAllocation(){
  if(!allocationEditable())return;
  allocationDraft=clone(state.game.players);allocationSelection=null;allocationChanges=[];renderAllocation();
}
function renderAllocation(){
  const g=state.game,roles=roleMap(g.config),error=allocationErrors()[0],s=allocationSelection,selected=s?allocationDraft[s.seat-1]:null;
  const hint=s?`${s.seat} 号${g.mode==='dual'?(s.slot?'下身份':'上身份'):''} · ${roles[selected.original[s.slot]].name}`:allocationChanges.at(-1)?.label||'点两张牌交换位置';
  openSheet('调整身份',`<div class="allocation-table"><div class="allocation-columns"><span>号码</span><span>${g.mode==='dual'?'上身份':'身份'}</span>${g.mode==='dual'?'<span>下身份</span>':''}</div>${allocationDraft.map(p=>`<div class="allocation-row"><strong>${String(p.seat).padStart(2,'0')}</strong>${p.original.map((id,slot)=>{const changed=id!==g.players[p.seat-1].original[slot];return `<button class="allocation-card ${s?.seat===p.seat&&s?.slot===slot?'selected':''} ${changed?'modified':''}" data-action="allocationCard" data-seat="${p.seat}" data-slot="${slot}" aria-label="${p.seat}号${g.mode==='dual'?(slot?'下身份':'上身份'):''} ${esc(roles[id].name)}${changed?'，已调整':''}" aria-pressed="${s?.seat===p.seat&&s?.slot===slot}">${esc(roles[id].name)}${changed?'<i aria-hidden="true"></i>':''}</button>`}).join('')}</div>`).join('')}</div>`,`${error?`<p class="allocation-error" role="alert">${esc(error)}</p>`:''}<div class="allocation-selection" role="status"><span>${s?'<small>已选</small> ':''}${esc(hint)}</span>${s?'<button class="text-action" data-action="allocationClear">取消选择</button>':''}</div><div class="allocation-tools"><button class="text-action" data-action="allocationUndo" ${allocationChanges.length?'':'disabled'}>撤销上一步</button><button class="text-action" data-action="allocationReset" ${allocationChanges.length?'':'disabled'}>重置调配</button></div><div class="button-row"><button class="secondary" data-action="cancelAllocation">取消</button><button class="primary" data-action="saveAllocation" ${error?'disabled':''}>保存调配</button></div>`);
  protectSheet(()=>allocationDraft.some((p,i)=>JSON.stringify(p.original)!==JSON.stringify(g.players[i].original)),renderAllocation);offerSheetBack(()=>{closeSheet();render()},'返回');
}

function selectAllocationCard(seat,slot){
  if(!allocationSelection){allocationSelection={seat,slot};renderAllocation();return}
  const a=allocationSelection,b={seat,slot};allocationSelection=null;
  if(a.seat===b.seat&&a.slot===b.slot){renderAllocation();return}
  const before=clone(allocationDraft),p=allocationDraft[a.seat-1],q=allocationDraft[b.seat-1];
  [p.original[a.slot],q.original[b.slot]]=[q.original[b.slot],p.original[a.slot]];
  p.cards=effectiveHand(p.original);q.cards=effectiveHand(q.original);
  allocationChanges.push({before,label:a.seat+' 号'+(a.slot?'下牌':'上牌')+' ↔ '+b.seat+' 号'+(b.slot?'下牌':'上牌')});renderAllocation();
}
function saveAllocation(){
  if(!allocationEditable())return;
  const errors=allocationErrors();if(errors.length)return toast(errors[0]);
  const g=state.game;let changed=0;
  for(const p of g.players){const d=allocationDraft[p.seat-1];if(JSON.stringify(p.original)!==JSON.stringify(d.original)){p.original=d.original.slice();p.cards=effectiveHand(p.original);p.shown=false;p.locked=g.started||g.config.rules.order==='deal';changed++}}
  save();closeSheet();render();toast(changed?'已调整 '+changed+' 位玩家，请重新核对身份':'身份未改变');
}

let playerNoteDraft=null,recentPlayerStatus=null;
function openPlayer(seat){
  const g=state.game,p=g.players[seat-1];if(!p)return;
  if(!playerNoteDraft||playerNoteDraft.seat!==seat)playerNoteDraft={seat,text:g.playerNotes[seat]||'',baseline:g.playerNotes[seat]||''};
  renderPlayer();
}
function renderPlayer(){
  const g=state.game,seat=playerNoteDraft.seat,p=g.players[seat-1],roles=roleMap(g.config),s=playerStatus(g,p),info=handInfo(p.cards,roles);
  const cardLabel=i=>g.mode==='dual'?(i?'下身份':'上身份'):'身份';
  openSheet(String(seat).padStart(2,'0')+' 号',`<div class="player-pager"><button data-action="adjacentPlayer" data-seat="${seat-1}" aria-label="上一位玩家" ${seat===1?'disabled':''}>${icon('back')}</button><div class="camp-summary"><strong>${info.wolf?'狼人阵营':'好人阵营'}</strong>${info.gold?'<b>金宝宝</b>':info.doubleWolf?'<b>金刚狼</b>':''}</div><button data-action="adjacentPlayer" data-seat="${seat+1}" aria-label="下一位玩家" ${seat===g.players.length?'disabled':''}>${icon('next')}</button></div><div class="player-hand-detail">${p.cards.map((id,i)=>{const lost=s.lost.has(i),enabled=g.started&&!isHistory(g)&&(lost||s.active===i);return `<div class="mini-role ${lost?'lost':s.active===i?'active':''}" data-player-card="${i}"><div><strong>${esc(roles[id].name)}${p.original[i]==='copy'?' · 复刻':''}</strong><small>${cardLabel(i)}${!lost&&g.mode==='dual'?(s.active===i?' · 生效':id==='hiddenwolf'?' · 随狼睁眼':' · 备用'):''}</small></div><button class="status-switch ${lost?'is-lost':s.active===i?'is-present':''} ${recentPlayerStatus?.seat===seat&&recentPlayerStatus?.slot===i?'just-changed':''}" role="switch" aria-checked="${!lost&&s.active===i}" aria-label="${seat}号${cardLabel(i)}在场状态" data-action="toggleCardStatus" data-seat="${seat}" data-slot="${i}" ${enabled?'':'disabled'}><span>${lost?(g.mode==='dual'?'已倒牌':'已出局'):s.active===i?'在场':'备用'}</span><i aria-hidden="true"></i></button></div>`}).join('')}</div>${s.alive&&!s.canVote?`<div class="result player-flip-status">白痴已翻牌，不可投票<button class="text-action" data-action="restoreFlip" data-seat="${seat}" ${isHistory(g)?'disabled':''}>撤销翻牌</button></div>`:''}<label class="field player-note-field"><span>玩家笔记<small data-player-draft-status>${playerNoteDraft.text===playerNoteDraft.baseline?'已保存':'未保存'}</small></span><textarea class="player-note-editor" data-player-note="${seat}" placeholder="记录该玩家的信息与行动">${esc(playerNoteDraft.text)}</textarea></label><details class="player-skills"><summary>身份技能</summary>${[...new Set(p.cards)].map(id=>`<div><div class="player-skill-title"><strong>${esc(roles[id].name)}</strong><button class="text-action" data-action="editRoleNote" data-id="${id}">身份笔记</button></div><p>${esc(roles[id].skill)}</p></div>`).join('')}</details>`,`<div class="button-row"><button class="secondary" data-action="showPlayer" data-seat="${seat}">${g.mode==='confidence'?'展示下家牌':'展示身份'}</button><button class="primary" data-action="confirmPlayerNote">确定</button></div>`);
  protectSheet(()=>playerNoteDraft.text!==playerNoteDraft.baseline,renderPlayer);recentPlayerStatus=null;
}
function confirmPlayerNote(){
  const g=state.game,d=playerNoteDraft,previous=g.playerNotes[d.seat];g.playerNotes[d.seat]=d.text;
  if(!save()){g.playerNotes[d.seat]=previous;toast('笔记保存失败，请重试');return}
  d.baseline=d.text;closeSheet();render();toast('笔记已保存');
}
function toggleCardStatus(seat,slot){
  const g=state.game,p=g.players[seat-1],st=playerStatus(g,p);
  if(!g.started||isHistory(g))return;
  if(st.lost.has(slot)){
    const plan=restorationPlan(g,seat,slot),label=g.mode==='dual'?(slot?'下身份':'上身份'):'身份';
    askConfirm('恢复 '+seat+' 号'+label+'？',(plan[0]?.slots.length>1?'该次出局涉及两张身份，将一并恢复。':'会撤销对应的倒牌或出局记录。')+(plan.length>1?'同时撤销 '+(plan.length-1)+' 条后续或关联记录。':'')+(plan.some(e=>e.actionKey)?'同时撤回对应的睁眼选择。':''),'确认恢复',()=>{restoreCard(g,seat,slot);recentPlayerStatus={seat,slot};save();render();openPlayer(seat);toast('已恢复',{success:true})});
    $('sheet').dataset.returnPlayer=String(seat);offerSheetBack(()=>openPlayer(seat),'返回玩家');return;
  }
  if(st.active!==slot)return;
  openDeath(seat,{returnPlayer:seat,fixedSeat:true});
}
function requestRestoreEvent(id){
  const e=state.game.events.find(e=>e.id===id);if(!e)return;
  if(e.reason==='idiotFlip'){askConfirm('撤销翻牌？',e.seat+' 号将恢复投票资格。','确认撤销',()=>{undoDeath(state.game,id);save();render()});return}
  toggleCardStatus(e.seat,e.slots[0]);
}
function requestStartGame(){
  const g=state.game,unseen=g.players.filter(p=>!p.shown),begin=()=>{startGame(g);state.tab='flow';setScreen('game')};
  if(!unseen.length){begin();return}
  const seats=unseen.map(p=>revealRecipient(g.mode,p.seat,g.players.length)).sort((a,b)=>a-b);
  askConfirm('仍然开始游戏？',seats.join('、')+' 号尚未查看身份。'+(g.mode==='dual'?'未确认的上下身份将沿用当前顺序。':''),'确认开始',begin);
}
function stepActors(id){
  const g=state.game,key=g.phase+':'+id,saved=g.actions[key];
  if(saved)return saved.actors;
  if(id==='gold')return g.players.filter(p=>playerStatus(g,p).remaining.length===2&&handInfo(p.cards,roleMap(g.config)).gold).map(p=>p.seat);
  return g.players.filter(p=>correctActor(g,p,id,key)).map(p=>p.seat);
}
function openStep(id){
  const step=getSteps(state.game).find(s=>s.id===id);if(!step)return;
  if(!step.action){
    const details={gold:'两张有效身份均为平民的玩家睁眼互认，确认后闭眼。',order:'未展示玩家沿用随机牌序；本局牌序已锁定。',debate:state.game.mode==='confidence'&&state.game.phase===1?'完成两轮发言，再进行放逐投票。':'依次发言后进行放逐投票。',talk1:'依次完成第一轮发言。',talk2:'依次完成第二轮发言，再进行放逐投票。',sheriff:'按开局约定竞选警长，记录警徽归属。',talk:'依次发言，核对仍可发言的玩家。',vote:'按桌规投票，记录实际放逐结果。',skills:'先确认资格，再结算开枪、翻牌与出局技能。终局先后按开局约定。'};
    const actors=state.game.mode!=='confidence'&&state.game.phase%2===0&&(id==='gold'||roleMap(state.game.config)[id])?stepActors(id):null;
    openSheet(step.name,`${actors?`<div class="automatic-actors simple-actors">${actors.length?actors.map(n=>`<span>${String(n).padStart(2,'0')}<small>号</small></span>`).join(''):'<p class="empty">无对应玩家</p>'}</div>`:''}<div class="skill-preview">${esc(details[id]||step.hint)}</div>${id==='debate'&&!isHistory(state.game)?'<button class="secondary full-width vote-open" data-action="voteOut">选择放逐玩家</button>':''}`,isHistory(state.game)?'<button class="secondary full-width" data-action="closeSheet">关闭</button>':`<button class="primary" data-action="finishSimple" data-id="${id}">标记完成</button>`);return;
  }
  const g=state.game,key=g.phase+':'+id,saved=g.actions[key];
  actionContext={id,key,step};
  actionDraft=saved?{...clone(saved),records:clone(actionRecords(g,saved,key))}:{actors:g.mode==='confidence'?[]:g.players.filter(p=>correctActor(g,p,id,key)).map(p=>p.seat),target:'',potion:'none',info:'',records:[]};
  if(g.mode!=='confidence'&&!saved)actionDraft.actors=g.players.filter(p=>correctActor(g,p,id,key)).map(p=>p.seat);
  actionBaseline='';renderAction();
}
function currentCorrectActors(){return state.game.mode==='confidence'?actionDraft.actors.filter(seat=>correctActor(state.game,state.game.players[seat-1],actionContext.id,actionContext.key)):actionDraft.actors}
function actionAllowed(){
  const g=state.game,id=actionContext.id;
  return currentCorrectActors().length>0&&!(g.mode==='confidence'&&g.phase===0&&(id==='wolves'||g.config.rules.firstGod==='confirm'));
}
function draftRecord(seat){
  if(!actionDraft.records)actionDraft.records=[];
  let record=actionDraft.records.find(r=>Number(r.seat)===seat);
  if(!record){record={seat,target:'',potion:'none',info:'',result:''};actionDraft.records.push(record)}
  return record;
}
function targetOptions(target,actorSeat,kind){
  const g=state.game;
  return g.players.filter(p=>playerStatus(g,p,actionContext.key).alive||String(p.seat)===String(target)).map(p=>{
    const selfDenied=p.seat===actorSeat&&(kind==='inspect'||(kind==='save'&&(g.config.rules.witchSelf==='never'||(g.config.rules.witchSelf==='first'&&g.phase>firstNightIndex(g)))));
    return `<option value="${p.seat}" ${String(target)===String(p.seat)?'selected':''} ${selfDenied?'disabled':''}>${p.seat} 号${selfDenied?' · 不可选':''}</option>`;
  }).join('');
}
function renderAction(){
  const g=state.game,{id,key,step}=actionContext,roles=roleMap(g.config),readonly=isHistory(g),selected=actionDraft.actors,correct=currentCorrectActors();
  const wrong=g.mode==='confidence'?selected.filter(n=>!correct.includes(n)):[];
  const allowed=actionAllowed(),firstNoKnife=g.mode==='confidence'&&g.phase===0&&id==='wolves';
  const effect=id==='wolves'?'team':roleEffect(roles[id]);
  const preview=id==='wolves'?(firstNoKnife?'狼人请睁眼。首夜无刀，仅确认实际睁眼者。':g.mode==='confidence'?'狼人请睁眼，共同确认刀口。无人正确睁眼则为空刀。':'狼人请睁眼，共同确认刀口。'):(roles[id]?.skill||step.hint);
  let fields='';
  if(id==='wolves')fields=`${targetControl(actionDraft.target,null,'team',null,'刀口记录',readonly||!allowed,firstNoKnife?'首夜无刀':'空刀')}`;
  else if(!correct.length)fields='<p class="empty">'+(g.mode==='confidence'?'没有此身份正确睁眼，不能发动技能。':'当前没有可行动的玩家。')+'</p>';
  else fields=correct.map(seat=>{
    const record=draftRecord(seat),p=g.players[seat-1],slot=playerStatus(g,p,key).active,stock=potionStock(g,seat,slot,key);
    let html=`<section class="actor-record ${correct.length===1?'single-actor-record':''}"><h3><b>${String(seat).padStart(2,'0')}</b> 号 · ${esc(roles[id].name)}</h3>`;
    if(effect==='medicine'){
      html+=`<div class="medicine-choices">${[['none','不用药'],['save','解药'],['poison','毒药']].map(([v,name])=>`<button class="${record.potion===v?'active':''}" data-action="potion" data-seat="${seat}" data-value="${v}" aria-pressed="${record.potion===v}" ${readonly||!allowed||(v!=='none'&&!stock[v])||(v==='save'&&g.mode==='confidence'&&g.phase===0)?'disabled':''}>${name}${v!=='none'&&!stock[v]?' · 已用':''}</button>`).join('')}</div>`;
    }
    if(!['text','status'].includes(effect)&&(effect!=='medicine'||record.potion!=='none')){
      const kind=effect==='medicine'?record.potion:effect;
      html+=`${targetControl(record.target,seat,kind,seat,effect==='inspect'?'查验目标':effect==='medicine'?'用药目标':'行动目标',readonly||!allowed)}<div id="record-result-${seat}">${recordResultMarkup(seat)}</div>`;
    }else if(effect==='status')html+='<p class="small muted status-copy">确认身份与状态，无需选择目标。</p>';
    if(correct.length>1||effect==='text')html+=`<label class="field"><span>${esc(roles[id].recordLabel||seat+' 号行动记录')}</span><textarea class="short" data-record-field="info" data-seat="${seat}" ${readonly?'disabled':''}>${esc(record.info)}</textarea></label>`;
    return html+'</section>';
  }).join('');
  openSheet(step.name,`<div class="action-context"><span>${phaseName(g.phase)}</span><span>${MODE_NAMES[g.mode]}</span></div>${readonly?'<div class="history-banner">历史行动 · 仅供查看</div>':''}<details class="callout-details"><summary>技能与口播</summary><p>${esc(preview)}</p></details><div class="section actor-section"><div class="section-head"><h3>${g.mode==='confidence'?'实际睁眼者':readonly||g.actions[key]?'行动时玩家':'本环节行动者'}</h3><span class="small muted">${g.mode==='confidence'?'点选号码':'按身份确定'}</span></div>${g.mode==='confidence'?`<div class="actor-grid">${g.players.map(p=>{const s=playerStatus(g,p,key),bad=wrong.includes(p.seat);return `<button class="actor ${selected.includes(p.seat)?'selected':''} ${bad?'wrong':''}" data-action="actor" data-seat="${p.seat}" aria-pressed="${selected.includes(p.seat)}" ${readonly||!s.alive?'disabled':''}>${p.seat}</button>`}).join('')}</div>`:`<div class="automatic-actors">${correct.length?correct.map(n=>`<span>${String(n).padStart(2,'0')}<small>号</small></span>`).join(''):'<p class="empty">无</p>'}</div>`}${wrong.length?`<div class="alert">${wrong.map(n=>n+' 号').join('、')} 睁眼身份不符；确认后暴毙，无遗言。</div>`:''}</div>${fields}<div id="action-result">${actionResultMarkup()}</div>${effect==='text'&&correct.length?'':`<label class="field"><span>行动信息</span><textarea class="short" data-action-field="info" placeholder="结果、技能与结算提醒" ${readonly?'disabled':''}>${esc(actionDraft.info)}</textarea></label>`}`,readonly?'<button class="secondary full-width" data-action="closeSheet">关闭</button>':'<button class="primary" data-action="saveAction">确认行动</button>');
  if(!readonly){if(!actionBaseline)actionBaseline=JSON.stringify(actionDraft);protectSheet(()=>JSON.stringify(actionDraft)!==actionBaseline,renderAction)}
}
function recordResultMarkup(seat){
  const g=state.game,record=draftRecord(seat),r=roleMap(g.config)[actionContext.id];
  const prior=g.actions[actionContext.key]?.records?.find(r=>r.seat===seat),result=Number(prior?.target)===Number(record.target)&&prior?.result?prior.result:record.target?seerResult(g,g.players[Number(record.target)-1]):'';
  if(roleEffect(r)==='inspect'&&record.target&&actionAllowed())return `<div class="result inspect-result"><span>${String(record.target).padStart(2,'0')}<small>号</small></span><strong>${esc(result)}</strong></div>`;
  return '';
}
function actionResultMarkup(){
  const g=state.game,id=actionContext.id;
  if(g.mode==='confidence'&&g.phase===0&&id==='wolves')return '<div class="result">首夜无刀</div>';
  if(id==='wolves'&&!currentCorrectActors().length)return '<div class="result">'+(g.mode==='confidence'?'空刀 · 没有狼人正确睁眼':'空刀 · 当前没有可行动的狼人')+'</div>';
  if(!actionAllowed()&&g.mode==='confidence'&&g.phase===0&&g.config.rules.firstGod==='confirm')return '<div class="result">首夜仅确认，不使用技能</div>';
  return '';
}
function saveAction(){
  try{
    const result=recordAction(state.game,actionContext.id,actionDraft);
    const name=actionContext.step.name;toggleDone(actionContext.id,true);save();closeSheet();renderGame();
    recordedFeedback(name,result.wrong.length?result.wrong.map(n=>n+'号').join('、')+' 暴毙，无遗言':'');
  }catch(e){toast(e.message)}
}

function recordedFeedback(name,warning=''){
  const next=getSteps(state.game).find(s=>!isDone(s.id));
  toast(warning||(name||'本项')+'已记录',next?{label:'下一项',action:()=>openStep(next.id)}:{});
}
function requestAdvance(){
  const g=state.game,advance=()=>{g.phase+=1;g.maxPhase=Math.max(g.phase,g.maxPhase);state.tab='flow';save();renderGame();clearToast()};
  const unfinished=getSteps(g).filter(s=>!isDone(s.id));
  if(unfinished.length){confirmTask=advance;openSheet('进入'+phaseName(g.phase+1)+'？',`<div class="advance-summary"><strong>${unfinished.length} 项未完成</strong><ul>${unfinished.map(s=>'<li>'+esc(s.name)+'</li>').join('')}</ul></div>`,`<div class="button-row"><button class="secondary" data-action="closeSheet">继续本阶段</button><button class="primary" data-action="confirmTask">进入下一阶段</button></div>`)}else advance();
}

function eligibleFinishSources(){
  const g=state.game,roles=roleMap(g.config);
  if(g.mode!=='dual'||g.config.rules.king!=='finish')return [];
  return g.players.filter(p=>playerStatus(g,p).remaining.length===2&&handInfo(p.cards,roles).doubleWolf&&!g.events.some(e=>e.reason==='finish'&&e.sourceSeat===p.seat));
}
function openDeath(seat,options={}){
  const g=state.game,alive=g.players.filter(p=>playerStatus(g,p).alive);
  if(isHistory(g))return toast('请回到最新阶段记录出局');
  if(!alive.length)return toast('所有玩家均已出局');
  deathContext={seat:seat||alive[0].seat,reason:options.reason||'other',sourceSeat:'',sourceEventId:'',...options};renderDeath();
}
function deathReasonDisabled(id){
  const g=state.game,p=g.players[deathContext.seat-1];
  return (id==='wolf'&&g.mode==='confidence'&&g.phase===0)||(id==='explode'&&(g.phase%2===0||!handInfo(p.cards,roleMap(g.config)).wolf||(g.mode==='confidence'&&!awakenedWolves(g).has(p.seat))));
}
function renderDeath(){
  const g=state.game,alive=g.players.filter(p=>playerStatus(g,p).alive),finish=eligibleFinishSources(),shots=eligibleShotSources(g),blasts=eligibleWhiteBlastSources(g);
  const options=Object.entries(DEATH_NAMES).filter(([id])=>!['idiotFlip',...(g.mode==='confidence'?[]:['miswake'])].includes(id)&&(id!=='finish'||finish.length)&&(id!=='shot'||shots.length)&&(id!=='whiteblast'||blasts.length));
  if(deathReasonDisabled(deathContext.reason))deathContext.reason='other';
  const p=g.players[deathContext.seat-1],s=playerStatus(g,p),r=roleMap(g.config)[p.cards[s.active]];
  if(deathContext.reason==='shot'&&shots.length===1&&!deathContext.sourceEventId)deathContext.sourceEventId=shots[0].eventId;
  if(deathContext.reason==='whiteblast'&&blasts.length===1&&!deathContext.sourceEventId)deathContext.sourceEventId=blasts[0].eventId;
  openSheet(deathContext.fixedSeat?'确认 '+p.seat+' 号'+(g.mode==='dual'?'倒牌':'出局'):'记录'+(g.mode==='dual'?'倒牌':'出局'),`${deathContext.fixedSeat?`<div class="status-target"><strong>${esc(r.name)}</strong><span>${g.mode==='dual'?(s.active?'下身份':'上身份'):'身份'}</span></div>`:`<div class="section-head"><h3>选择玩家</h3><span class="small muted">${deathContext.seat} 号 · ${esc(r.name)}</span></div><div class="death-seat-grid">${alive.map(p=>`<button class="actor ${deathContext.seat===p.seat?'selected':''}" data-action="deathSeat" data-seat="${p.seat}" aria-pressed="${deathContext.seat===p.seat}">${p.seat}</button>`).join('')}</div>`}<h3 class="reason-heading">原因<span>仅主持人可见</span></h3><div class="reason-grid">${options.map(([id,name])=>`<button class="reason ${deathContext.reason===id?'active':''}" data-action="deathReason" data-value="${id}" aria-pressed="${deathContext.reason===id}" ${deathReasonDisabled(id)?'disabled':''}>${name}</button>`).join('')}</div>
  ${deathContext.reason==='finish'?`<label class="field"><span>发动完杀的金刚狼 · 限一次</span><select data-death-field="sourceSeat"><option value="">请选择</option>${finish.map(p=>`<option value="${p.seat}" ${Number(deathContext.sourceSeat)===p.seat?'selected':''}>${p.seat} 号</option>`).join('')}</select></label>`:''}
  ${deathContext.reason==='whiteblast'?`<label class="field"><span>自爆的白狼王</span><select data-death-field="sourceEventId"><option value="">请选择</option>${blasts.map(source=>`<option value="${source.eventId}" ${deathContext.sourceEventId===source.eventId?'selected':''}>${source.seat} 号</option>`).join('')}</select></label>`:''}
  ${deathContext.reason==='shot'?`<label class="field"><span>开枪的猎人</span><select data-death-field="sourceEventId"><option value="">请选择</option>${shots.map(source=>`<option value="${source.eventId}" ${deathContext.sourceEventId===source.eventId?'selected':''}>${source.seat} 号 · ${esc(source.name)}</option>`).join('')}</select></label>`:''}
  ${deathContext.reason==='miswake'?'<div class="alert">睁错眼暴毙，没有遗言。</div>':''}
  ${deathContext.reason==='vote'&&p.cards[s.active]==='idiot'?'<div class="result">白痴翻牌免死，继续在场，失去投票权。</div>':''}
  ${g.mode==='dual'?`<p class="small muted status-copy">${deathContext.reason==='finish'?'完杀会带走全部剩余身份。':s.remaining.length>1?'上身份倒牌后，下身份自动生效。':'最后一张身份倒牌后，玩家出局。'}</p>`:''}`,`<button class="primary" data-action="saveDeath">确认${g.mode==='dual'?'倒牌':'出局'} · ${deathContext.seat} 号</button>`);
  if(deathContext.returnPlayer){$('sheet').dataset.returnPlayer=String(deathContext.returnPlayer);offerSheetBack(()=>openPlayer(deathContext.returnPlayer),'返回玩家')}
}
function saveDeath(){
  try{
    const e=addDeath(state.game,Number(deathContext.seat),deathContext.reason,{...(deathContext.reason==='finish'?{sourceSeat:Number(deathContext.sourceSeat)}:{}),...(['shot','whiteblast'].includes(deathContext.reason)?{sourceEventId:deathContext.sourceEventId}:{}),...(deathContext.reason==='miswake'?{noLastWords:true}:{})});
    const back=deathContext.returnPlayer;if(back)recentPlayerStatus={seat:back,slot:e.slots[0]};save();closeSheet();render();if(back)openPlayer(back);toast(e.reason==='idiotFlip'?e.seat+' 号翻牌，仍在场':e.seat+' 号已记录',{success:true});
  }catch(e){toast(e.message)}
}
function announce(){
  const g=state.game,night=g.phase%2?g.phase-1:g.phase;
  const seats=Array.from(new Set(g.events.filter(e=>e.phase===night&&e.slots.length&&!playerStatus(g,g.players[e.seat-1],null,night).alive).map(e=>e.seat)));
  closeSheet();revealContext={announcement:true,seats};renderReveal();if(!$('reveal').open)$('reveal').showModal();syncModalState();
}

function openRules(){
  const mode=state.screen==='config'||state.screen==='home'?state.mode:state.game.mode,c=state.screen==='config'||state.screen==='home'?config():state.game.config,r=c.rules;
  const self={first:'女巫仅首夜可自救',never:'女巫全程不可自救',always:'女巫全程可自救'}[r.witchSelf];
  let rules=[];
  if(mode==='standard')rules=['好人淘汰全部狼人获胜；狼人淘汰全部平民或全部神职获胜。','首夜按所选身份确认，之后按夜间顺序行动。',r.sheriff?'首日进行警长竞选，之后发言与放逐投票。':'本局不竞选警长。',self+'。两瓶药各限一次，同夜不能双用；解药用尽后不再向女巫报刀口。','白痴被放逐时翻牌留场、失去投票权。猎人仅在狼刀或放逐倒牌时有开枪资格；中毒、睁错眼或被枪带走不触发。终局与技能先后按桌规。'];
  if(mode==='dual'){
    rules=['每人两张身份；上身份生效，倒牌后下身份解锁。两张都倒后玩家出局。',r.order==='player'?'玩家查看时可交换上下身份，确认后锁定。开始记录前主持人仍可调配。':'按发牌顺序锁定上下身份；开始记录前主持人仍可调配。','任一张有效身份为狼人，该玩家属于狼人阵营。复刻牌复制另一张并置于下身份。'+'生效狼牌或仍持有隐狼牌的玩家必须随狼队睁眼。','金宝宝为两张有效身份均是平民的玩家，至少一人。'+(r.forbidWolfSeer?'狼与预言家不能同手。':''),'好人'+(r.goodWin==='awakeWolves'?'清空所有可睁眼的狼人':'清空全部狼牌')+'获胜；狼人'+(r.win==='edge'?'清空全部金宝宝或全部神牌':'清空全部金宝宝')+'获胜。',r.king==='finish'?'金刚狼可完杀一次，一次带走目标剩余两张身份；发动前两张狼牌都须在场。':r.king==='checkGood'?'金刚狼上牌查为好人，下身份按当前狼牌判定。':'金刚狼按普通双狼处理，不额外获得技能。',r.singleLoss==='phase'?'同一阶段最多倒一张牌，完杀例外。':r.singleLoss==='round'?'同一整轮最多倒一张牌，完杀例外。':'同轮可多次倒牌。',r.silence?'夜间首张身份倒牌后，白天禁言、禁票一轮。':'仍有身份的玩家可正常发言与投票。',self+'。预言家查验'+(r.seerCheck==='faction'?'两牌最终阵营。':'当前生效身份；隐狼本牌验好。')];
  }
  if(mode==='confidence')rules=['每位玩家查看下家的底牌：点击自己号码 +1 的号码牌；末位玩家点击 1 号。','完全跳过首夜，从第一天开始；两轮发言后进行放逐投票。','没有警长竞选。好人淘汰全部狼人，狼人淘汰全部平民或全部神职获胜。','夜间按身份环节叫醒。正确睁眼者可行使技能；睁错眼者暴毙，没有遗言。','预言家查验真实底牌。狼人的底牌始终查为狼人，与是否睁眼无关。','没有狼人正确睁眼，视为空刀。已正确睁眼的狼可在白天自爆。','第二天及之后天亮时只宣布哪些人出局，不向玩家展示死亡原因。',self.replace('首夜','首个实际夜晚')+'。开局不安排任何夜间行动。'];
  rules.push('行动目标与实际倒牌分别记录；守护、魅惑、连锁技能和胜负由主持人按局况确认。');
  const sources=mode==='dual'?`<a href="https://zydwz2001.github.io/two-identities-werewolf/" target="_blank" rel="noreferrer">5–8 人牌库</a><a href="https://www.langrensha.net/strategy/2022092701.html" target="_blank" rel="noreferrer">双身份版本一</a><a href="https://zhuanlan.zhihu.com/p/2078496581888881121" target="_blank" rel="noreferrer">双身份版本二</a>`:mode==='standard'?`<a href="https://werewolves.games/yu-nv-lie-bai/" target="_blank" rel="noreferrer">预女猎白参考</a>`:'按本局约定';
  openSheet(MODE_NAMES[mode]+' · 本局规则',`<div class="rule-copy"><ol>${rules.map(text=>'<li>'+esc(text)+'</li>').join('')}</ol></div><div class="rule-divider"><h3 style="margin-bottom:12px">身份技能</h3>${c.roles.filter(role=>role.count).map(role=>`<div style="margin-top:13px"><strong class="small">${esc(role.name)} ×${role.count}</strong><p class="small muted" style="line-height:1.75;margin-top:4px">${esc(role.skill)}</p></div>`).join('')}</div><div class="source-links">${sources}</div>`);
}
function syncModalState(){document.documentElement.classList.toggle('modal-open',$('sheet').open||$('reveal').open)}
function updateViewport(){
  const vv=window.visualViewport,h=vv?.height||window.innerHeight,top=vv?.offsetTop||0,gap=Math.max(0,window.innerHeight-h-top);
  document.documentElement.style.setProperty('--view-height',h+'px');
  document.documentElement.style.setProperty('--view-top',top+'px');
  document.documentElement.style.setProperty('--keyboard-gap',gap+'px');
  document.body.classList.toggle('keyboard-open',gap>120&&document.activeElement?.matches('input,textarea,select'));
}

function inputRecord(el){
  if(el.dataset.noteKind){const g=state.game,key=el.dataset.noteKey;if(el.dataset.noteKind==='phase')g.notes[key].text=el.value;else if(el.dataset.noteKind==='role')g.roleNotes[key]=el.value;else g.playerNotes[key]=el.value;queueSave()}
  if(el.matches('[data-note-search]')){state.noteQuery=el.value;state.journalFolds={};refreshJournal();queueSave()}
  if(el.matches('[data-phase-note]')){phaseNote().text=el.value;queueSave()}
  if(el.dataset.roleNote){state.game.roleNotes[el.dataset.roleNote]=el.value;queueSave()}
  if(el.dataset.playerNote&&playerNoteDraft){playerNoteDraft.text=el.value;const status=$('sheet').querySelector('[data-player-draft-status]');if(status)status.textContent=playerNoteDraft.text===playerNoteDraft.baseline?'已保存':'未保存'}
  if(el.dataset.roleEdit)roleDraft[el.dataset.roleEdit]=['count','order'].includes(el.dataset.roleEdit)?Number(el.value):el.value;
  if(el.dataset.actionField){actionDraft[el.dataset.actionField]=el.value;if($('action-result'))$('action-result').innerHTML=actionResultMarkup()}
  if(el.dataset.recordField){const seat=Number(el.dataset.seat),r=draftRecord(seat);r[el.dataset.recordField]=el.value;if($('record-result-'+seat))$('record-result-'+seat).innerHTML=recordResultMarkup(seat)}
}
document.addEventListener('click',async event=>{
  rememberView();
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const {action,id,value,seat,delta,kind}=button.dataset;
  if(toastTask&&['count','editRole','mode','deal','addRoleMenu','preset'].includes(action))clearToast();
  try{
    switch(action){
      case 'chooseGame':setScreen('config');break;
      case 'quickMode':state.mode=value;setScreen('config');break;
      case 'chooseTarget':chooseActionTarget(button,Number(seat),value);break;
      case 'avalon':toast('阿瓦隆待开发');break;
      case 'resume':state.mode=state.game.mode;setScreen(state.game.started?'game':'deal');break;
      case 'back':goBack();break;
      case 'rules':openRules();break;
      case 'mode':state.mode=value;state.configRulesOpen=false;save();renderConfig();break;
      case 'preset':setPreset(Number(value));break;
      case 'resetConfig':askConfirm('恢复默认配置？','本模式的角色、技能和桌规将恢复默认，不影响已开始的本局。','恢复默认',()=>{state.configs[state.mode]=makeConfig(state.mode);save();renderConfig()});break;
      case 'confirmTask':{const task=confirmTask;closeSheet();task?.();break}
      case 'count':{
        if(kind==='players')config().players=Math.max(3,Math.min(24,config().players+Number(delta)));
        else {const role=config().roles.find(r=>r.id===id);role.count=Math.max(0,Math.min(48,role.count+Number(delta)))}
        save();renderConfig();break;
      }
      case 'editRole':editRole(id);break;
      case 'addRoleMenu':addRoleMenu();break;
      case 'addRole':config().roles.push({id,count:1,...clone(ROLE_BANK[id])});save();closeSheet();renderConfig();break;
      case 'customRole':roleBaseline='';roleDraft={id:'custom_'+Date.now().toString(36),name:'',count:1,camp:'god',night:'every',order:50,effect:'text',recordLabel:'行动记录',skill:''};renderRoleEditor();break;
      case 'saveRole':saveRole();break;
      case 'removeRole':{const c=config(),before=clone(c.roles),mode=state.mode,name=roleDraft.name;c.roles=c.roles.filter(r=>r.id!==roleDraft.id);save();closeSheet();renderConfig();toast('已移除 '+name,{action:()=>{state.configs[mode].roles=before;save();renderConfig();toast('已恢复 '+name)}});break}
      case 'deal':startDeal();break;
      case 'reveal':showReveal(Number(seat));break;
      case 'revealNext':{const recipient=nextRecipient();if(recipient)showReveal(revealTarget(state.game.mode,recipient,state.game.players.length));break}
      case 'uncover':revealContext.phase='shown';renderReveal();break;
      case 'coverReveal':revealContext.phase='cover';renderReveal();break;
      case 'swapCards':{const p=state.game.players[revealContext.targetSeat-1];if(!p.locked){const boxes=Array.from($('reveal').querySelectorAll('.identity')).map(el=>el.getBoundingClientRect());p.cards.reverse();p.original.reverse();save();renderReveal();animateCardSwap(boxes)}break}
      case 'confirmReveal':confirmReveal(button.dataset.next==='yes');break;
      case 'closeReveal':closeReveal();break;
      case 'fullscreen':if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen().catch(()=>{});else if(document.fullscreenElement)await document.exitFullscreen();break;
      case 'startGame':requestStartGame();break;
      case 'dealTab':state.dealTab=value;save();renderDeal();break;
      case 'closeSheet':requestCloseSheet();break;
      case 'gameTab':clearToast();state.tab=value;save();renderGame();break;
      case 'phaseMenu':openPhaseMenu();break;
      case 'viewPhase':{const phase=Number(button.dataset.phase);if(Number.isInteger(phase)&&phase>=0&&phase<=state.game.maxPhase){rememberView();state.game.phase=phase;save();closeSheet();header();renderGame()}break}
      case 'prevPhase':state.game.phase=Math.max(0,state.game.phase-1);save();renderGame();break;
      case 'forwardPhase':state.game.phase=Math.min(state.game.maxPhase,state.game.phase+1);save();renderGame();break;
      case 'latestPhase':state.game.phase=state.game.maxPhase;save();renderGame();break;
      case 'advance':requestAdvance();break;
      case 'checkStep':if(!isHistory(state.game)){toggleDone(id);renderGame()}break;
      case 'openStep':openStep(id);break;
      case 'finishSimple':if(!isHistory(state.game)){const name=getSteps(state.game).find(s=>s.id===id)?.name;toggleDone(id,true);closeSheet();renderGame();recordedFeedback(name)}break;
      case 'actor':{if(isHistory(state.game)||state.game.mode!=='confidence')break;const n=Number(seat);actionDraft.actors=actionDraft.actors.includes(n)?actionDraft.actors.filter(x=>x!==n):actionDraft.actors.concat([n]);renderAction();break}
      case 'potion':draftRecord(Number(seat)).potion=value;draftRecord(Number(seat)).target='';renderAction();break;
      case 'saveAction':saveAction();break;
      case 'playerFilter':state.filter=value;save();render();break;
      case 'player':playerNoteDraft=null;openPlayer(Number(seat));break;
      case 'adjacentPlayer':requestCloseSheet(()=>{playerNoteDraft=null;openPlayer(Number(seat))});break;
      case 'resetPlayerFilter':state.filter='all';state.playerRole='all';save();render();break;
      case 'showPlayer':requestCloseSheet(()=>{playerNoteDraft=null;showReveal(revealTarget(state.game.mode,Number(seat),state.game.players.length))});break;
      case 'confirmPlayerNote':confirmPlayerNote();break;
      case 'toggleCardStatus':requestCloseSheet(()=>{playerNoteDraft=null;toggleCardStatus(Number(seat),Number(button.dataset.slot))});break;
      case 'restoreEvent':requestRestoreEvent(id);break;
      case 'restoreFlip':{const e=state.game.events.find(e=>e.seat===Number(seat)&&e.reason==='idiotFlip');if(e)requestCloseSheet(()=>{playerNoteDraft=null;requestRestoreEvent(e.id)});break}
      case 'voteOut':openDeath(null,{reason:'vote'});break;
      case 'death':openDeath(Number(seat)||null);break;
      case 'deathSeat':deathContext.seat=Number(seat);renderDeath();break;
      case 'deathReason':deathContext.reason=value;renderDeath();break;
      case 'saveDeath':saveDeath();break;
      case 'undoEvent':requestRestoreEvent(id);break;
      case 'editAwake':openStep(id);break;
      case 'announce':announce();break;
      case 'sheetBack':requestCloseSheet(sheetBack);break;
      case 'resumeDraft':dismissDraft(false);break;
      case 'discardDraft':dismissDraft(true);break;
      case 'retrySave':if(save())toast('已保存');break;
      case 'toastAction':{const fn=toastTask;clearToast();fn?.();break}
      case 'redeal':requestRedeal();break;
      case 'allocationClear':allocationSelection=null;renderAllocation();break;
      case 'allocationReset':allocationDraft=clone(state.game.players);allocationChanges=[];allocationSelection=null;renderAllocation();break;
      case 'journalEntry':openJournalEntry(id);break;
      case 'journalFilters':state.journalFilterOpen=!state.journalFilterOpen;save();$('view').querySelector('.journal-v2').classList.toggle('filters-open',state.journalFilterOpen);refreshJournal();break;
      case 'journalKind':state.journalKind=value;save();renderGame();break;
      case 'journalFold':{state.journalFolds||={};const phase=Number(button.dataset.phase);state.journalFolds[phase]=!(state.journalFolds[phase]??(state.game.maxPhase>5&&phase<state.game.maxPhase-3));save();refreshJournal();break}
      case 'journalExpand':state.journalFolds=Object.fromEntries(Array.from({length:state.game.maxPhase+1},(_,i)=>[i,false]));save();refreshJournal();break;
      case 'clearNoteSearch':state.noteQuery='';save();const search=$('view').querySelector('[data-note-search]');if(search){search.value='';search.focus()}refreshJournal();break;
      case 'resetJournal':state.noteQuery='';state.journalKind='all';state.journalPhase='all';save();renderGame();break;
      case 'editAllocation':editAllocation();break;
      case 'allocationCard':selectAllocationCard(Number(seat),Number(button.dataset.slot));break;
      case 'allocationUndo':{const last=allocationChanges.pop();if(last)allocationDraft=last.before;allocationSelection=null;renderAllocation();break}
      case 'cancelAllocation':requestCloseSheet(()=>{closeSheet();render()});break;
      case 'saveAllocation':saveAllocation();break;
      case 'editPhaseNote':editNote('phase',Number(button.dataset.phase));break;
      case 'editRoleNote':requestCloseSheet(()=>{playerNoteDraft=null;editNote('role',id)});break;
      case 'editPlayerNote':editNote('player',Number(seat));break;
      case 'closeNote':if(save()){closeSheet();renderGame()}break;
      case 'noteTab':state.noteTab=value;save();renderGame();break;
      case 'roleFilter':state.roleFilter=id;save();renderGame();break;
    }
  }catch(error){toast(error.message||'操作未完成')}
});
document.addEventListener('input',event=>inputRecord(event.target));
document.addEventListener('change',event=>{
  const el=event.target;
  rememberView();inputRecord(el);
  if(el.dataset.countInput){
    const value=Number(el.value),kind=el.dataset.countInput,min=kind==='players'?3:0,max=kind==='players'?24:48;
    if(!el.value.trim()||!Number.isInteger(value)||value<min||value>max){toast('请输入 '+min+'–'+max+' 的整数');renderConfig();return}
    if(kind==='players')config().players=value;else config().roles.find(r=>r.id===el.dataset.id).count=value;
    save();renderConfig();
  }
  if(el.dataset.rule){
    config().rules[el.dataset.rule]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;save();
    const errors=validateConfig(config(),state.mode),hint=$('dock').querySelector('.dock-hint'),button=$('dock').querySelector('.primary');
    hint.textContent=errors[0]||'';hint.hidden=!errors.length;hint.classList.toggle('error',errors.length>0);button.disabled=errors.length>0;
  }
  if(el.matches('[data-player-role]')){state.playerRole=el.value;save();render()}
  if(el.matches('[data-journal-kind]')){state.journalKind=el.value;save();renderGame()}
  if(el.matches('[data-note-role]')){state.roleFilter=el.value;save();renderGame()}
  if(el.matches('[data-journal-phase]')){state.journalPhase=el.value;save();renderGame()}
  if(el.matches('[data-note-seat]')){state.noteSeat=Number(el.value);save();renderGame()}
  if(el.matches('[data-view-phase]')){state.game.phase=Number(el.value);save();renderGame();window.scrollTo({top:0})}
  if(el.dataset.deathField){deathContext[el.dataset.deathField]=el.dataset.deathField==='sourceSeat'?Number(el.value):el.value;renderDeath()}
});
document.addEventListener('toggle',event=>{if(event.target.id==='config-rules'){state.configRulesOpen=event.target.open;save()}},true);
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('.count-input,[data-note-search]'))event.target.blur()});
document.addEventListener('focusin',updateViewport);
document.addEventListener('focusout',()=>{save();requestAnimationFrame(updateViewport)});
window.visualViewport?.addEventListener('resize',updateViewport);
window.visualViewport?.addEventListener('scroll',updateViewport);
window.addEventListener('resize',updateViewport);
window.addEventListener('scroll',rememberView,{passive:true});
window.addEventListener('beforeunload',event=>{rememberView();if(!save()||sheetGuard?.dirty()||pendingGuard?.dirty()){event.preventDefault();event.returnValue=''}});
window.addEventListener('pagehide',()=>{rememberView();save()});
$('sheet').addEventListener('click',event=>{if(event.target===$('sheet'))requestCloseSheet()});
$('sheet').addEventListener('close',()=>{syncModalState();if(state.screen==='game'&&state.tab==='notes')renderGame()});
$('sheet').addEventListener('cancel',event=>{event.preventDefault();requestCloseSheet()});
$('reveal').addEventListener('cancel',event=>{event.preventDefault();closeReveal()});
installSheetDrag();

document.addEventListener('visibilitychange',()=>{if(document.hidden){save();if(revealContext&&!revealContext.announcement){revealContext.phase='cover';renderReveal()}}});
updateViewport();
render();
