const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const corePath = process.argv[2] || path.join(__dirname, '..', 'game-core.js');
const ctx = { console, crypto: require('node:crypto').webcrypto };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(corePath, 'utf8') + '\nthis.api={makeConfig,generateHands,validHands,roleMap,handInfo,createGame,startGame,revealTarget,revealRecipient,playerStatus,addDeath,undoDeath,recordAction,seerResult,awakenedWolves,validateConfig,getSteps,correctActor,restoreCard,restorationPlan,potionStock,eligibleShotSources,eligibleWhiteBlastSources};', ctx);
const a = ctx.api;
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function fixed(mode, hands) {
  const g = a.createGame(a.makeConfig(mode), mode);
  g.players = hands.map((cards, i) => ({ seat: i + 1, cards: cards.slice(), original: cards.slice(), shown: false, locked: true }));
  g.config.players = hands.length;
  g.started = true;
  return g;
}
function phase(g, n) { g.phase = g.maxPhase = n; }

check('1,600 dual deals: card conservation, restrictions, hidden wolf lower', () => {
  for (const n of [5, 6, 7, 8]) for (let i = 0; i < 400; i++) {
    const c = a.makeConfig('dual', n), hands = a.generateHands(c, 'dual');
    assert.equal(hands.length, n);
    assert(hands.every(h => h.length === 2));
    assert(a.validHands(hands, a.roleMap(c), c.rules));
    const counts = Object.fromEntries(c.roles.map(r => [r.id, r.count]));
    for (const h of hands) { for (const id of h) counts[id]--; if (h.includes('hiddenwolf')) assert.equal(h[1], 'hiddenwolf'); }
    assert(Object.values(counts).every(n => n === 0));
    assert(hands.some(h => h.every(id => id === 'villager')));
  }
});
check('default configurations and validation', () => {
  for (const mode of ['standard', 'dual', 'confidence']) assert.equal(a.validateConfig(a.makeConfig(mode), mode).length, 0);
  const c = a.makeConfig('dual', 7);
  assert.equal(c.roles.find(r => r.id === 'whitewolfking').count, 1);
  assert.equal(c.roles.find(r => r.id === 'wolf').count, 1);
  assert.equal(c.rules.king, 'finish');
  c.roles[0].count--;
  assert(a.validateConfig(c, 'dual').length > 0);
  const roles = a.roleMap(a.makeConfig('dual', 6));
  assert.equal(a.validHands([['wolf', 'seer'], ['villager', 'villager']], roles, c.rules), false);
  assert.equal(a.validHands([['wolf', 'seer'], ['villager', 'villager']], roles, {...c.rules, forbidWolfSeer:false}), true);
});
check('confidence skips opening night, has day-one voting and neighbor mapping', () => {
  const g = a.createGame(a.makeConfig('confidence'), 'confidence');
  a.startGame(g); assert.equal(g.phase, 1); assert.equal(g.maxPhase, 1);
  assert.deepEqual(Array.from(a.getSteps(g), s => s.id), ['debate', 'skills']);
  assert.match(a.getSteps(g)[0].hint, /两轮.*放逐/);
  a.addDeath(g, 1, 'vote');
  for (let i = 1; i <= 9; i++) { const target = a.revealTarget('confidence', i, 9); assert.equal(target, i % 9 + 1); assert.equal(a.revealRecipient('confidence', target, 9), i); }
});
check('confidence actors, miswake, empty knife and truthful seer', () => {
  const g = fixed('confidence', [['wolf'], ['seer'], ['villager'], ['witch'], ['hunter']]); phase(g, 2);
  assert.match(a.seerResult(g, g.players[0]), /狼人/);
  let result = a.recordAction(g, 'wolves', {actors:[1,2], target:3, info:''});
  assert.equal(result.action.target, 3); assert.equal(a.playerStatus(g,g.players[1]).alive, false);
  assert(g.events.find(e=>e.seat===2).noLastWords); assert(a.awakenedWolves(g).has(1));
  a.restoreCard(g,2,0); assert(a.playerStatus(g,g.players[1]).alive); assert(!g.actions['2:wolves'].actors.includes(2));
  result = a.recordAction(g,'wolves',{actors:[],target:3,info:''}); assert(result.action.emptyKnife); assert.equal(result.action.target,'');
  phase(g,3); assert.throws(()=>a.addDeath(g,1,'explode'),/正确睁眼/);
});
check('dual automatic actors follow upper cards and hidden wolf', () => {
  const g = fixed('dual', [['villager','hiddenwolf'], ['wolf','villager'], ['villager','seer'], ['seer','villager'], ['villager','villager'], ['witch','hunter']]);
  assert(a.correctActor(g,g.players[0],'wolves')); assert(a.correctActor(g,g.players[1],'wolves'));
  assert(!a.correctActor(g,g.players[2],'seer')); assert(a.correctActor(g,g.players[3],'seer'));
  const result = a.recordAction(g,'wolves',{actors:[3],target:5,info:''});
  assert.deepEqual(Array.from(result.action.actors),[1,2]); assert.equal(result.wrong.length,0);
  a.addDeath(g,3,'wolf'); assert(a.correctActor(g,g.players[2],'seer'));
  assert.throws(()=>a.addDeath(g,4,'miswake'),/只有自信狼/);
});
check('dual same-phase losses and restoration cascade', () => {
  const g=fixed('dual',[['seer','villager'],['wolf','wolf'],['villager','villager']]);
  a.addDeath(g,1,'wolf'); assert.equal(a.playerStatus(g,g.players[0]).active,1);
  a.addDeath(g,1,'poison'); assert.equal(a.playerStatus(g,g.players[0]).alive,false);
  assert.equal(a.restorationPlan(g,1,0).length,2); a.restoreCard(g,1,0);
  assert.equal(a.playerStatus(g,g.players[0]).active,0); assert.equal(g.events.length,0);
});
check('hunter linked deaths restore together', () => {
  const g=fixed('standard',[['hunter'],['wolf'],['villager']]);
  const death=a.addDeath(g,1,'wolf'); assert.equal(a.eligibleShotSources(g).length,1);
  a.addDeath(g,2,'shot',{sourceEventId:death.id}); assert.equal(a.eligibleShotSources(g).length,0);
  a.restoreCard(g,1,0); assert(g.players.every(p=>a.playerStatus(g,p).alive));
  a.addDeath(g,1,'poison'); assert.equal(a.eligibleShotSources(g).length,0);
});
check('white wolf explosion and linked restoration', () => {
  const g=fixed('dual',[['whitewolfking','villager'],['seer','villager'],['villager','villager']]);
  g.config.roles.push({id:'whitewolfking',count:1,name:'白狼王',camp:'wolf',night:'team'}); phase(g,1);
  const death=a.addDeath(g,1,'explode'); assert.equal(a.eligibleWhiteBlastSources(g).length,1);
  a.addDeath(g,2,'whiteblast',{sourceEventId:death.id}); a.addDeath(g,2,'other');
  a.restoreCard(g,1,0); assert.equal(g.events.length,0); assert(g.players.every(p=>a.playerStatus(g,p).remaining.length===2));
});
check('golden wolf finish once and undo', () => {
  const g=fixed('dual',[['wolf','wolf'],['seer','villager'],['villager','villager']]);
  a.addDeath(g,2,'finish',{sourceSeat:1}); assert.equal(a.playerStatus(g,g.players[1]).alive,false);
  assert.throws(()=>a.addDeath(g,3,'finish',{sourceSeat:1}),/完杀/); a.restoreCard(g,2,1);
  assert.equal(a.playerStatus(g,g.players[1]).remaining.length,2); a.addDeath(g,3,'finish',{sourceSeat:1});
});
check('witch per-card inventory and first actual night self-save', () => {
  const g=fixed('confidence',[['witch'],['wolf'],['villager']]); phase(g,2);
  a.recordAction(g,'witch',{actors:[1],records:[{seat:1,potion:'save',target:1}],info:''});
  assert.equal(a.potionStock(g,1,0).save,false); phase(g,4);
  assert.throws(()=>a.recordAction(g,'witch',{actors:[1],records:[{seat:1,potion:'save',target:2}]}),/已使用/);
  const h=fixed('confidence',[['witch'],['wolf'],['villager']]); phase(h,4);
  assert.throws(()=>a.recordAction(h,'witch',{actors:[1],records:[{seat:1,potion:'save',target:1}]}),/不允许.*自救/);
});
check('guard repeated target, seer self-check, idiot flip, history protection', () => {
  const g=fixed('standard',[['guard'],['seer'],['idiot'],['wolf'],['villager']]);
  g.config.roles.push({id:'guard',count:1,name:'守卫',camp:'god',night:'every'});
  a.recordAction(g,'guard',{target:5}); phase(g,2);
  assert.throws(()=>a.recordAction(g,'guard',{target:5}),/连续两晚/);
  assert.throws(()=>a.recordAction(g,'seer',{target:2}),/自己/);
  phase(g,3); const e=a.addDeath(g,3,'vote'); assert.equal(e.reason,'idiotFlip'); assert(a.playerStatus(g,g.players[2]).alive); assert(!a.playerStatus(g,g.players[2]).canVote);
  a.undoDeath(g,e.id); assert(a.playerStatus(g,g.players[2]).canVote);
  g.phase=1; assert.throws(()=>a.addDeath(g,5,'other'),/最新阶段/); assert.throws(()=>a.restoreCard(g,5,0),/最新阶段/); assert.throws(()=>a.recordAction(g,'seer',{}),/历史行动/);
});
console.log(JSON.stringify({passed:checks,randomDeals:1600}));
