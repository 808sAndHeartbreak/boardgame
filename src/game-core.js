const MODE_NAMES={standard:'标准狼',dual:'双身份',confidence:'自信狼'};
const ROLE_BANK={
  villager:{name:'平民',camp:'civil',night:'none',order:90,skill:'没有主动技能。通过发言和投票寻找狼人。'},
  wolf:{name:'狼人',camp:'wolf',night:'team',order:30,skill:'夜晚与狼队共同选择一名玩家袭击。'},
  seer:{name:'预言家',camp:'god',night:'every',order:50,skill:'每晚查验一名玩家，获知其身份对应的好人或狼人信息。'},
  witch:{name:'女巫',camp:'god',night:'every',order:40,skill:'一瓶解药、一瓶毒药，各限用一次。同一晚不能同时使用两瓶药。'},
  hunter:{name:'猎人',camp:'god',night:'every',order:70,skill:'被狼刀或放逐出局时可开枪带走一人；被毒出局不能开枪。先向主持人确认开枪资格。'},
  idiot:{name:'白痴',camp:'god',night:'first',order:65,skill:'被放逐时可翻牌免死，此后失去投票权。被狼刀或毒杀仍会倒牌。'},
  guard:{name:'守卫',camp:'god',night:'every',order:10,skill:'每晚可守护一人，也可空守。不能连续两晚守护同一人。同守同救按开局桌规。'},
  knight:{name:'骑士',camp:'god',night:'first',order:75,skill:'白天可翻牌决斗一人。对方为狼人则对方倒牌，否则骑士倒牌。具体判定与白天是否结束按桌规。'},
  dreamer:{name:'摄梦人',camp:'god',night:'every',order:15,skill:'每晚选择梦游目标。连续梦游及牵连死亡由主持人按开局约定结算。'},
  gravekeeper:{name:'守墓人',camp:'god',night:'every',order:55,skill:'夜晚获知前一日被放逐身份的信息。首夜没有前一日信息。'},
  hiddenwolf:{name:'隐狼',camp:'wolf',night:'team',order:30,skill:'双身份局中位于下身份时也可随狼人睁眼。查验按当前身份；隐狼牌本身查验为好人。'},
  whitewolfking:{name:'白狼王',camp:'wolf',night:'team',order:30,skill:'随狼人睁眼；白天自爆时可带走一名玩家。双身份按生效身份与本局桌规结算，由主持人记录实际倒牌。'},
  wolfking:{name:'狼王',camp:'wolf',night:'team',order:30,skill:'随狼人睁眼。出局后的狼枪资格和可触发的死亡方式须在开局前约定。'},
  wolfbeauty:{name:'狼美人',camp:'wolf',night:'every',order:20,skill:'每晚魅惑一人，再参与狼队行动。牵连死亡和技能顺序按开局约定结算。'},
  copy:{name:'复刻牌',camp:'god',night:'first',order:0,skill:'复制同一玩家另一张牌的身份与技能，并置于下身份。双复刻不能同手。'},
  scapegoat:{name:'替罪羊',camp:'god',night:'none',order:90,skill:'平票时的替代放逐及投票限制，按开局前约定执行。'}
};
const DUAL_PRESETS={
  5:{counts:{villager:6,wolf:1,hiddenwolf:1,seer:1,witch:1}},
  6:{counts:{villager:6,wolf:2,hiddenwolf:1,seer:1,witch:1,hunter:1}},
  7:{counts:{villager:7,wolf:1,whitewolfking:1,hiddenwolf:1,seer:1,witch:1,hunter:1,knight:1}},
  8:{counts:{villager:8,wolf:3,hiddenwolf:1,seer:1,witch:1,hunter:1,knight:1}}
};
function clone(value){return JSON.parse(JSON.stringify(value))}
function makeConfig(mode,n){
  n=n||(mode==='standard'?12:mode==='dual'?6:9);
  const preset=mode==='dual'?DUAL_PRESETS[n]:null;
  const counts=preset?preset.counts:(n===12?{villager:4,wolf:4,seer:1,witch:1,hunter:1,idiot:1}:{villager:3,wolf:3,seer:1,witch:1,hunter:1});
  return {players:n,roles:Object.entries(counts).map(([id,count])=>({id,count,...clone(ROLE_BANK[id])})),rules:{
    sheriff:mode==='standard',witchSelf:'first',guardSave:'die',
    goldMin:1,goldMax:n,forbidWolfSeer:true,allowDoubleWolf:true,
    wolfMin:1,wolfMax:n,order:'player',
    king:'finish',singleLoss:'off',silence:false,win:'golden',seerCheck:'active',
    firstGod:'normal',goodWin:'allCards',wolfAwake:'active',wolfNoWakePenalty:true
  }};
}
function roleMap(config){return Object.fromEntries(config.roles.map(r=>[r.id,r]))}
function fixedDualRules(config){Object.assign(config.rules,{goldMin:1,goldMax:config.players,wolfMin:1,wolfMax:config.players,allowDoubleWolf:true,singleLoss:'off',silence:false,win:'golden',goodWin:'allCards',seerCheck:'active',wolfAwake:'active'});return config}
function countCards(config){return config.roles.reduce((n,r)=>n+r.count,0)}
function effectiveHand(hand){
  if(hand.length===2&&hand.includes('copy'))return hand.map(r=>r==='copy'?hand.find(x=>x!=='copy')||'copy':r);
  return hand.slice();
}
function handInfo(hand,roles){
  const ids=effectiveHand(hand),isWolf=id=>roles[id]?.camp==='wolf';
  return {wolf:ids.some(isWolf),doubleWolf:ids.length===2&&ids.every(isWolf),gold:ids.length===2&&ids.every(id=>roles[id]?.camp==='civil'),seer:ids.includes('seer')};
}
function validateConfig(config,mode){
  const errors=[],expected=config.players*(mode==='dual'?2:1),count=countCards(config);
  if(!Number.isInteger(config.players)||config.players<3||config.players>24)errors.push('人数须为 3–24 人');
  if(count!==expected)errors.push(count<expected?'还需添加 '+(expected-count)+' 张身份牌':'请减少 '+(count-expected)+' 张身份牌');
  if(config.roles.some(r=>!Number.isInteger(r.count)||r.count<0||r.count>48))errors.push('身份数量须为 0–48');
  if(!config.roles.some(r=>r.camp==='wolf'&&r.count>0))errors.push('至少配置一张狼人身份');
  if(!config.roles.some(r=>r.camp!=='wolf'&&r.count>0))errors.push('至少配置一张好人身份');
  if((mode!=='dual'||config.rules.win==='edge')&&!config.roles.some(r=>r.camp==='god'&&r.count>0))errors.push('屠边局至少配置一张神职身份');
  if(mode!=='dual'&&!config.roles.some(r=>r.camp==='civil'&&r.count>0))errors.push('屠边局至少配置一张平民身份');
  if(mode==='dual'){
    const r=config.rules,civ=config.roles.filter(x=>x.camp==='civil').reduce((n,x)=>n+x.count,0);
    if(!Number.isInteger(r.goldMin)||!Number.isInteger(r.goldMax)||r.goldMin<1||r.goldMax<r.goldMin||r.goldMax>config.players)errors.push('金宝宝下限至少 1 人，请检查数量范围');
    if(civ<r.goldMin*2&&!config.roles.some(x=>x.id==='copy'&&x.count))errors.push('平民牌不足，无法满足金宝宝下限');
    if(r.wolfMin<1||r.wolfMax<r.wolfMin||r.wolfMax>config.players)errors.push('请检查狼人玩家数范围');
  }
  return errors;
}
function randomInt(max){
  if(typeof crypto!=='undefined'&&crypto.getRandomValues){const a=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%max}
  return Math.floor(Math.random()*max);
}
function shuffle(items){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function validHand(hand,roles,rules){
  const info=handInfo(hand,roles);
  return !(hand[0]==='copy'&&hand[1]==='copy')&&!(rules.forbidWolfSeer&&info.wolf&&info.seer)&&!(!rules.allowDoubleWolf&&info.doubleWolf);
}
function validHands(hands,roles,rules){
  if(hands.some(h=>!validHand(h,roles,rules)))return false;
  const infos=hands.map(h=>handInfo(h,roles)),gold=infos.filter(x=>x.gold).length,wolves=infos.filter(x=>x.wolf).length;
  return gold>=rules.goldMin&&gold<=rules.goldMax&&wolves>=rules.wolfMin&&wolves<=rules.wolfMax;
}
function generateHands(config,mode){
  const errors=validateConfig(config,mode);if(errors.length)throw new Error(errors[0]);
  const roles=roleMap(config),deck=config.roles.flatMap(r=>Array(r.count).fill(r.id));
  if(mode!=='dual')return shuffle(deck).map(id=>[id]);
  for(let attempt=0;attempt<2500;attempt++){
    const d=shuffle(deck),hands=Array.from({length:config.players},(_,i)=>d.slice(i*2,i*2+2));
    if(validHands(hands,roles,config.rules))return normalizeHands(hands);
  }
  let nodes=0,answer=null;
  function pair(remaining,hands,gold,wolves){
    if(++nodes>200000)return false;
    if(gold>config.rules.goldMax||wolves>config.rules.wolfMax)return false;
    if(!remaining.length){if(gold>=config.rules.goldMin&&wolves>=config.rules.wolfMin){answer=hands;return true}return false}
    const wolfLeft=remaining.filter(id=>roles[id]?.camp==='wolf').length,civilLeft=remaining.filter(id=>roles[id]?.camp==='civil').length,copyLeft=remaining.filter(id=>id==='copy').length;
    if(wolves+wolfLeft<config.rules.wolfMin||gold+Math.floor((civilLeft+copyLeft)/2)<config.rules.goldMin)return false;
    const first=remaining[0],choices=shuffle(Array.from(new Set(remaining.slice(1))));
    for(const second of choices){
      const hand=[first,second];if(!validHand(hand,roles,config.rules))continue;
      const rest=remaining.slice(1),i=rest.indexOf(second);rest.splice(i,1);
      const info=handInfo(hand,roles);if(pair(rest,hands.concat([hand]),gold+Number(info.gold),wolves+Number(info.wolf)))return true;
    }
    return false;
  }
  pair(shuffle(deck),[],0,0);
  if(!answer)throw new Error('当前牌库无法满足发牌限制，请调整牌数或桌规');
  return normalizeHands(shuffle(answer));
}
function normalizeHands(hands){return hands.map(h=>h.includes('copy')?[h.find(x=>x!=='copy'),'copy']:h.includes('hiddenwolf')?[h.find(x=>x!=='hiddenwolf')||'hiddenwolf','hiddenwolf']:shuffle(h))}
function createGame(config,mode){
  const hands=generateHands(config,mode);
  return {mode,config:clone(config),players:hands.map((original,i)=>({seat:i+1,cards:effectiveHand(original),original:original.slice(),shown:false,locked:false})),phase:mode==='confidence'?1:0,maxPhase:mode==='confidence'?1:0,phaseStart:mode==='confidence'?1:0,actions:{},notes:{},roleNotes:{},playerNotes:{},events:[],started:false,createdAt:Date.now()};
}
function revealTarget(mode,recipient,n){return mode==='confidence'?recipient%n+1:recipient}
function revealRecipient(mode,target,n){return mode==='confidence'?(target+n-2)%n+1:target}
function roleEffect(role){
  if(role.effect)return role.effect;
  if(role.id.startsWith('custom'))return 'text';
  if(role.id==='seer')return 'inspect';
  if(role.id==='witch')return 'medicine';
  if(['hunter','idiot','knight','gravekeeper','copy','scapegoat'].includes(role.id)||role.night==='first')return 'status';
  return 'target';
}
function startGame(game){
  game.started=true;
  if(game.mode==='confidence'&&game.phase===0){game.phase=1;game.maxPhase=Math.max(1,game.maxPhase)}
  game.players.forEach(p=>p.locked=true);
  return game;
}
function firstNightIndex(game){return game.mode==='confidence'?2:0}
function isHistory(game){return game.phase<game.maxPhase}
function playerStatus(game,player,ignoreAction,atPhase=game.phase){
  const events=game.events.filter(e=>e.seat===player.seat&&e.phase<=atPhase&&(!ignoreAction||e.actionKey!==ignoreAction));
  const lost=new Set(events.flatMap(e=>e.slots||[])),revealed=new Set(events.filter(e=>e.reason==='idiotFlip').map(e=>e.cardSlot));
  const remaining=player.cards.map((_,i)=>i).filter(i=>!lost.has(i)),active=remaining.length?remaining[0]:-1;
  return {lost,remaining,active,alive:remaining.length>0,revealed,canVote:!revealed.has(active)};
}
function activeRole(game,player,ignoreAction){const s=playerStatus(game,player,ignoreAction);return s.alive?roleMap(game.config)[player.cards[s.active]]:null}
function correctActor(game,player,actionId,ignoreAction){
  if(!player)return false;
  const s=playerStatus(game,player,ignoreAction);if(!s.alive)return false;
  const roles=roleMap(game.config),active=player.cards[s.active];
  if(actionId==='wolves')return roles[active]?.camp==='wolf'||(game.mode==='dual'&&s.remaining.some(i=>player.cards[i]==='hiddenwolf'));
  return active===actionId;
}
function awakenedWolves(game){
  return new Set(Object.entries(game.actions).filter(([key,a])=>a.id==='wolves'&&Number(key.split(':')[0])<=game.phase).flatMap(([,a])=>a.correctActors||[]));
}
function sleepingWolves(game,actors,ignoreAction){
  if(game.mode!=='confidence'||game.phase<2||game.phase%2!==0||game.config.rules.wolfNoWakePenalty===false)return [];
  const awake=new Set(actors.map(Number));
  return game.players.filter(p=>!awake.has(p.seat)&&correctActor(game,p,'wolves',ignoreAction)).map(p=>p.seat);
}
function seerResult(game,player){
  const s=playerStatus(game,player),roles=roleMap(game.config);
  if(!s.alive)return '已出局';
  const info=handInfo(player.cards,roles),id=player.cards[s.active],role=roles[id];
  if(game.mode==='confidence')return role.name+(role.camp==='wolf'?(role.name==='狼人'?'':' · 狼人'):' · 好人');
  if(game.mode==='dual'){
    if(game.config.rules.seerCheck==='faction')return info.wolf?'狼人阵营':'好人阵营';
    if(id==='hiddenwolf'||(info.doubleWolf&&s.active===0&&game.config.rules.king==='checkGood'))return '好人';
  }
  return role.camp==='wolf'?'狼人':'好人';
}
function actionRecords(game,action,key){
  if(action.records)return action.records;
  return (action.correctActors||[]).map(seat=>({
    seat,slot:playerStatus(game,game.players[seat-1],null,Math.max(-1,Number(key.split(':')[0])-1)).active,
    target:action.target||'',potion:action.potion||'none',info:action.info||'',result:action.result||''
  }));
}
function potionStock(game,seat,slot,ignoreKey){
  const stock={save:true,poison:true};
  for(const [key,a] of Object.entries(game.actions)){
    if(key===ignoreKey||Number(key.split(':')[0])>game.phase)continue;
    for(const r of actionRecords(game,a,key))if(r.seat===seat&&r.slot===slot&&['save','poison'].includes(r.potion))stock[r.potion]=false;
  }
  return stock;
}
function eligibleShotSources(game){
  const roles=roleMap(game.config);
  return game.events.filter(e=>e.phase===game.phase&&['wolf','vote'].includes(e.reason)&&e.slots.some(i=>game.players[e.seat-1].cards[i]==='hunter')&&!game.events.some(shot=>shot.sourceEventId===e.id)).map(e=>({eventId:e.id,seat:e.seat,name:roles.hunter?.name||'猎人'}));
}
function eligibleWhiteBlastSources(game){
  return game.events.filter(e=>e.phase===game.phase&&e.reason==='explode'&&e.slots.some(i=>game.players[e.seat-1].cards[i]==='whitewolfking')&&!game.events.some(child=>child.reason==='whiteblast'&&child.sourceEventId===e.id)).map(e=>({eventId:e.id,seat:e.seat}));
}
function restorationPlan(game,seat,slot){
  const first=game.events.find(e=>e.seat===seat&&e.slots?.includes(slot));if(!first)return [];
  const start=game.events.indexOf(first),ids=new Set(game.events.filter((e,i)=>i>=start&&e.seat===seat&&(e.slots?.length||e.reason==='idiotFlip')).map(e=>e.id));
  let changed=true;while(changed){changed=false;for(let i=0;i<game.events.length;i++){const e=game.events[i];if(e.sourceEventId&&ids.has(e.sourceEventId)&&!ids.has(e.id)){ids.add(e.id);changed=true}if(ids.has(e.id))for(let j=i+1;j<game.events.length;j++){const later=game.events[j];if(later.seat===e.seat&&(later.slots?.length||later.reason==='idiotFlip')&&!ids.has(later.id)){ids.add(later.id);changed=true}}}}
  return game.events.filter(e=>ids.has(e.id));
}
function restoreCard(game,seat,slot){
  if(isHistory(game))throw new Error('请回到最新阶段修改状态');
  const events=restorationPlan(game,seat,slot),ids=new Set(events.map(e=>e.id));
  for(const e of events)if(e.actionKey){const a=game.actions[e.actionKey];if(a){if(e.reason==='missedWake'){a.actors=Array.from(new Set(a.actors.concat(e.seat)));a.correctActors=Array.from(new Set((a.correctActors||[]).concat(e.seat)));a.emptyKnife=false}else{a.actors=a.actors.filter(n=>n!==e.seat);a.correctActors=(a.correctActors||[]).filter(n=>n!==e.seat);a.records=(a.records||[]).filter(r=>r.seat!==e.seat)}}}
  game.events=game.events.filter(e=>!ids.has(e.id));return events;
}
function addDeath(game,seat,reason,extra={}){
  if(isHistory(game))throw new Error('请回到最新阶段记录出局');
  if(reason==='miswake'&&game.mode!=='confidence')throw new Error('只有自信狼记录睁错眼');
  const player=game.players.find(p=>p.seat===seat),status=player&&playerStatus(game,player);if(!status?.alive)throw new Error('该玩家已出局');
  if(reason==='missedWake'&&(game.mode!=='confidence'||game.phase<2||game.phase%2!==0||!correctActor(game,player,'wolves')))throw new Error('仅记录自信狼夜间未睁眼的在场狼人');
  if(game.mode==='confidence'&&game.phase===0&&reason==='wolf')throw new Error('自信狼首夜无刀');
  if(reason==='explode'&&game.phase%2===0)throw new Error('自爆须在白天记录');
  if(reason==='explode'&&!handInfo(player.cards,roleMap(game.config)).wolf)throw new Error('只有狼人玩家可以自爆');
  if(reason==='explode'&&game.mode==='confidence'&&!awakenedWolves(game).has(seat))throw new Error('只有已正确睁眼的狼人可以自爆');
  if(reason==='shot'&&!eligibleShotSources(game).some(s=>s.eventId===extra.sourceEventId))throw new Error('本阶段没有可开枪的猎人，毒杀、睁错眼和被枪带走均不可开枪');
  if(reason==='whiteblast'&&!eligibleWhiteBlastSources(game).some(e=>e.eventId===extra.sourceEventId))throw new Error('本阶段没有可带人的白狼王自爆记录');
  if(reason==='finish'){
    const source=game.players.find(p=>p.seat===Number(extra.sourceSeat)),sourceStatus=source&&playerStatus(game,source);
    if(game.mode!=='dual'||game.config.rules.king!=='finish'||!sourceStatus?.alive||sourceStatus.remaining.length!==2||!handInfo(source.cards,roleMap(game.config)).doubleWolf||game.events.some(e=>e.reason==='finish'&&e.sourceSeat===source.seat))throw new Error('没有可使用完杀的金刚狼');
  }
  const event={id:'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),recordedAt:Date.now(),phase:game.phase,seat,reason,slots:[],...extra};
  if(reason==='vote'&&player.cards[status.active]==='idiot'){
    if(status.revealed.has(status.active))throw new Error('白痴已翻牌，不再参与放逐');
    Object.assign(event,{reason:'idiotFlip',cardSlot:status.active});game.events.push(event);return event;
  }
  const all=reason==='finish'||extra.all;
  if(game.mode==='dual'&&!all&&game.config.rules.singleLoss!=='off'){
    const blocked=game.events.some(e=>e.seat===seat&&(game.config.rules.singleLoss==='round'?Math.floor(e.phase/2)===Math.floor(game.phase/2):e.phase===game.phase)&&e.slots?.length);
    if(blocked)throw new Error(game.config.rules.singleLoss==='round'?'本轮已损失一张身份牌':'本阶段已损失一张身份牌');
  }
  event.slots=all?status.remaining.slice():[status.active];
  game.events.push(event);return event;
}
function undoDeath(game,id){
  if(isHistory(game))throw new Error('历史出局不可直接修改，可在该阶段补充笔记');
  const event=game.events.find(e=>e.id===id);
  if(!event)return;
  if(event.actionKey)throw new Error('请在对应夜间行动中修改实际睁眼者');
  if(game.events.some(e=>e.sourceEventId===id))throw new Error('请先撤销由这次出局触发的关联记录');
  game.events=game.events.filter(e=>e.id!==id);
}
function recordAction(game,id,draft){
  if(isHistory(game))throw new Error('历史行动仅供查看，请回到最新阶段记录');
  const key=game.phase+':'+id,roles=roleMap(game.config);
  const previous=game.actions[key];
  const actors=game.mode==='confidence'?Array.from(new Set(draft.actors.map(Number))).filter(n=>game.players.some(p=>p.seat===n)):(previous?.correctActors||game.players.filter(p=>correctActor(game,p,id,key)).map(p=>p.seat));
  const correctActors=game.mode==='confidence'?actors.filter(seat=>correctActor(game,game.players[seat-1],id,key)):actors.slice();
  const wrong=game.mode==='confidence'?actors.filter(seat=>!correctActors.includes(seat)&&playerStatus(game,game.players[seat-1],key).alive):[];
  const sleeping=id==='wolves'?sleepingWolves(game,actors,key):[];
  const firstConfirm=game.mode==='confidence'&&game.phase===0&&game.config.rules.firstGod==='confirm';
  const records=id==='wolves'?[]:correctActors.map(seat=>{
    const player=game.players[seat-1],slot=previous?.records?.find(r=>r.seat===seat)?.slot??playerStatus(game,player,key).active;
    const source=draft.records?.find(r=>Number(r.seat)===seat)||draft;
    const record={seat,slot,target:source.target?Number(source.target):'',potion:source.potion||'none',info:source.info||'',result:''};
    const effect=roleEffect(roles[id]);
    if(effect==='text'){record.target='';record.potion='none';return record}
    if(firstConfirm||effect==='status'){record.target='';record.potion='none';return record}
    const previousRecord=previous?.records?.find(r=>r.seat===seat);
    if(record.target&&record.target!==Number(previousRecord?.target)&&!playerStatus(game,game.players[record.target-1],key).alive)throw new Error('请选择仍在场的行动目标');
    if(effect==='medicine'){
      if(record.potion!=='none'){
        if(!record.target)throw new Error(seat+' 号用药尚未选择目标');
        const stock=potionStock(game,seat,slot,key);
        if(!stock[record.potion])throw new Error(seat+' 号这张身份的'+(record.potion==='save'?'解药':'毒药')+'已使用');
        if(record.potion==='save'){
          if(game.mode==='confidence'&&game.phase===0)throw new Error('首夜无刀，不使用解药');
          if(record.target===seat&&(game.config.rules.witchSelf==='never'||(game.config.rules.witchSelf==='first'&&game.phase>firstNightIndex(game))))throw new Error('本局桌规不允许此时自救');
        }
      }else record.target='';
    }else record.potion='none';
    if(id==='guard'&&record.target){
      const prevKey=(game.phase-2)+':'+id,prev=game.actions[prevKey];
      if(prev&&actionRecords(game,prev,prevKey).some(r=>r.seat===seat&&Number(r.target)===record.target))throw new Error('守卫不能连续两晚守护同一人');
    }
    if(effect==='inspect'&&record.target){
      if(id==='seer'&&record.target===seat)throw new Error('预言家不能查验自己');
      record.result=record.target===Number(previousRecord?.target)&&previousRecord?.result?previousRecord.result:seerResult(game,game.players[record.target-1]);
    }
    return record;
  });
  let target=draft.target?Number(draft.target):'';
  if(id==='wolves'&&((game.mode==='confidence'&&game.phase===0)||!correctActors.length))target='';
  if(target&&id==='wolves'&&target!==Number(previous?.target)&&!playerStatus(game,game.players[target-1],key).alive)throw new Error('刀口目标已出局');
  const action={...clone(draft),recordedAt:previous?.recordedAt||Date.now(),id,phase:game.phase,actors,correctActors,records,target:id==='wolves'?target:records[0]?.target||'',potion:records[0]?.potion||'none',result:records[0]?.result||'',emptyKnife:id==='wolves'&&correctActors.length===0};
  game.events=game.events.filter(e=>e.actionKey!==key);
  for(const seat of wrong)if(playerStatus(game,game.players[seat-1]).alive)addDeath(game,seat,'miswake',{actionKey:key,noLastWords:true});
  for(const seat of sleeping)if(playerStatus(game,game.players[seat-1]).alive)addDeath(game,seat,'missedWake',{actionKey:key});
  game.actions[key]=action;return {action,wrong,sleeping};
}

function phaseName(index){return '第 '+(Math.floor(index/2)+1)+(index%2?' 天':' 夜')}
function getSteps(game){
  const {mode,config,phase}=game,first=phase===firstNightIndex(game),day=phase%2===1,roles=config.roles.filter(r=>r.count>0);
  if(day){
    return [...(phase===1&&config.rules.sheriff&&mode!=='confidence'?[{id:'sheriff',name:'警长竞选',hint:'按开局桌规'}]:[]),{id:'debate',name:'发言与放逐',hint:mode==='confidence'&&phase===1?'两轮发言后进行放逐投票':'依次发言，随后进行放逐投票'},{id:'skills',name:'出局技能结算',hint:'核对开枪与翻牌资格'}];
  }
  const steps=roles.filter(r=>r.night==='every'||(r.night==='first'&&first)).map(r=>({id:r.id,name:r.name+(r.night==='first'?'确认':''),hint:r.skill,order:r.order,action:r.night!=='first'||mode==='confidence'}));
  if(roles.some(r=>r.camp==='wolf'))steps.push({id:'wolves',name:'狼人',hint:'共同选择刀口',order:roles.find(r=>r.camp==='wolf'&&r.night==='team')?.order??30,action:true});
  if(mode==='dual'&&first){steps.push({id:'gold',name:'金宝宝互认',hint:'两张有效身份均为平民',order:-10});steps.push({id:'order',name:'核对上下身份',hint:'按已锁定牌序核对',order:-20})}
  return steps.sort((a,b)=>a.order-b.order);
}
