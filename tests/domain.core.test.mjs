import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, DEFAULT_SETTINGS, normalizeSettings, SCORE_BASE, PAR_MS, timeBonus,
  computeScore, isAssisted, createRecord, computeStats, trend, personalBest,
  dailyCalendar, emptyArchive, saveActive, startNew, resume, markCompleted,
  listUnfinished, restoreRecovery, removeEntry, ARCHIVE_LIMIT, STORAGE_KEYS,
  createStore, migrateLegacy, exportData, importData, shouldPromptReview, ImportError
} from '../src/domain/index.js';

test('settings normalization accepts only known fields and never throws',()=>{
  assert.equal(THEMES.length,6);assert.equal(DEFAULT_SETTINGS.schema,2);
  const s=normalizeSettings({theme:'ocean',colorMode:'dark',showTimer:false,lastDifficulty:'expert',unknown:1,haptics:'yes'});
  assert.equal(s.theme,'ocean');assert.equal(s.showTimer,false);assert.equal(s.lastDifficulty,'expert');assert.equal(s.haptics,false);assert.equal('unknown' in s,false);
  assert.deepEqual(normalizeSettings(null),normalizeSettings({}));assert.doesNotThrow(()=>normalizeSettings(Symbol('x')));
  assert.doesNotThrow(()=>normalizeSettings(new Proxy({}, {get(){throw Error('hostile getter');}})));
});

test('time bonus and score follow caps, penalties and floor',()=>{
  assert.deepEqual(SCORE_BASE,{easy:1000,medium:2000,hard:3000,expert:4000});assert.equal(PAR_MS.easy,600000);
  assert.equal(timeBonus('easy',0),1200);assert.equal(timeBonus('easy',600000),600);assert.equal(timeBonus('easy',1200000),0);
  assert.equal(timeBonus('easy',-5),1200);assert.equal(computeScore({difficulty:'easy',elapsedMs:0,hints:1,mistakes:2}),2050);
  assert.equal(computeScore({difficulty:'easy',elapsedMs:1200000,hints:100,mistakes:100}),100);
  assert.equal(isAssisted({hints:0,checks:1}),true);assert.equal(isAssisted({hints:0}),false);
});

const rec=(id,completedAt,difficulty='easy',assisted=false,elapsedMs=1000,score=1000)=>({id,difficulty,assisted,completedAt,elapsedMs,score,assist:{hints:assisted?1:0},mistakes:0,dailyKey:null});
test('records, stats filters, recent cap, trend and personal best are consistent',()=>{
  const created=createRecord({id:'g',difficulty:'hard',dailyKey:null,completedAt:1,elapsedMs:5000,mistakes:2,assist:{hints:1}});
  assert.equal(created.assisted,true);assert.equal(created.score,4048);
  const records=Array.from({length:12},(_,i)=>rec(`r${i}`,i,'easy',i%2===0,2000-i*10,100+i));
  assert.equal(computeStats(records,'all').total,12);assert.equal(computeStats(records,'unassisted').total,6);assert.equal(computeStats(records,'assisted').total,6);assert.equal(computeStats(records).recent.length,12);
  assert.equal(computeStats(Array.from({length:25},(_,i)=>rec(`recent${i}`,i))).recent.length,20);
  const t=trend(records,{difficulty:'easy',assisted:true});assert.deepEqual(t.latest,{n:5,avgMs:1940,avgScore:106});assert.equal(t.previous.n,1);assert.equal(trend([records[0]],{difficulty:'easy',assisted:true}),null);
  const pb=personalBest(records,rec('new',13,'easy',false,500,2000));assert.equal(pb.isBestTime,true);assert.equal(pb.isBestScore,true);assert.equal(pb.previousBestMs,1890);
});

test('archive preserves prior active games and bounds recovery snapshots',()=>{
  const game=(id,n)=>({id,kind:'random',difficulty:'easy',createdAt:n,updatedAt:n,completed:false,values:[n]});
  let a=emptyArchive();a=startNew(a,game('a',0),0);a=startNew(a,game('b',1),1);
  assert.equal(a.activeId,'b');assert.equal(a.entries.a.game.values[0],0);assert.equal(listUnfinished(a).length,2);
  a=saveActive(a,game('b',2),60001);assert.equal(a.entries.b.recovery.length,1);assert.equal(a.entries.b.recovery[0].game.values[0],1);
  a=saveActive(a,game('b',3),120002);a=saveActive(a,game('b',4),180003);a=saveActive(a,game('b',5),240004);assert.equal(a.entries.b.recovery.length,3);
  const recovered=restoreRecovery(a,'b',a.entries.b.recovery[0].savedAt);assert.equal(recovered.entries.b.game.values[0],2);assert.equal(recovered.entries.b.recovery.length,3);
  assert.equal(resume(a,'a').activeId,'a');assert.equal(markCompleted(a,'a',20).entries.a.status,'completed');assert.equal(removeEntry(a,'a').entries.a,undefined);assert.equal(ARCHIVE_LIMIT,50);
  const many={activeId:'live',entries:{}};for(let i=0;i<51;i++)many.entries[`done${i}`]={id:`done${i}`,status:'completed',updatedAt:i};many.entries.live={id:'live',status:'active',updatedAt:99};
  const pruned=saveActive(many,game('next',100),100);assert.equal(Object.keys(pruned.entries).length,50);assert.equal(pruned.entries.done0,undefined);assert.ok(pruned.entries.live);
  const unfinished={activeId:null,entries:{}};for(let i=0;i<55;i++)unfinished.entries[`u${i}`]={id:`u${i}`,status:'active',updatedAt:i};assert.equal(Object.keys(saveActive(unfinished,game('u55',99),99).entries).length,56);
});

test('calendar marks daily status and exposes no streak fields',()=>{
  const rows=dailyCalendar([{...rec('d',1,'medium',false,1,1),dailyKey:'2000-01-01'}],{entries:{x:{dailyKey:'2000-01-02',status:'active'}}},2000,1);
  assert.equal(rows.length,31);assert.equal(rows[0].status,'completed');assert.equal(rows[1].status,'in-progress');assert.ok(rows.every(x=>!('streak' in x)));
});

class MemoryBackend { data=new Map();getItem(k){return this.data.has(k)?this.data.get(k):null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);} }
test('legacy migration is idempotent and preserves original keys',()=>{
  const b=new MemoryBackend();const game={difficulty:'medium',createdAt:10,values:[1]};b.setItem('sudoku-app:game',JSON.stringify({version:1,savedAt:20,game}));b.setItem('sudoku-app:settings',JSON.stringify({theme:'dark'}));
  const first=createStore(b).load();assert.equal(first.meta.migratedFrom,1);assert.equal(first.settings.colorMode,'dark');assert.equal(first.archive.entries['legacy-20'].game.values[0],1);
  assert.ok(b.getItem('sudoku-app:game'));const second=createStore(b).load();assert.deepEqual(second,first);assert.ok(migrateLegacy(b));
});

test('corrupt JSON is preserved and defaults safely; quota errors return false',()=>{
  const b=new MemoryBackend();b.setItem(STORAGE_KEYS.settings,'{oops');const store=createStore(b);const data=store.load();assert.equal(data.settings.theme,'graphite');assert.ok([...b.data.keys()].some(k=>k.startsWith(`sudoku:v2:corrupt:${STORAGE_KEYS.settings}:`)));assert.equal(b.getItem(STORAGE_KEYS.settings),'{oops');
  const failing={getItem(){return null;},setItem(){throw Error('quota');},removeItem(){}};assert.equal(createStore(failing).saveSettings({}),false);
});

test('export/import round trips and retains conflicting copies and current settings',()=>{
  const data={schema:2,settings:normalizeSettings({theme:'rose'}),archive:{activeId:'x',entries:{x:{id:'x',game:{v:1}}}},records:[rec('r',1)],meta:{installedAt:1,completedCount:1,reviewPromptedAt:null,migratedFrom:null}};
  const exported=exportData(data);const imported=importData(data,exported);assert.deepEqual(imported.data,data);assert.deepEqual(imported.added,{records:0,entries:0});
  const incoming={...data,settings:normalizeSettings({theme:'ocean'}),archive:{activeId:'x',entries:{x:{id:'x',game:{v:2}},y:{id:'y',game:{v:3}}}},records:[rec('r2',2)]};
  const result=importData(data,JSON.stringify({format:'sudoku-app-export',version:2,data:incoming}));assert.equal(result.data.archive.entries.x.game.v,1);assert.equal(result.data.archive.entries['x-imported'].game.v,2);assert.ok(result.data.archive.entries.y);assert.equal(result.data.settings.theme,'rose');assert.deepEqual(result.conflicts,[{kind:'entry',id:'x'},{kind:'settings',id:'settings'}]);assert.equal(result.added.records,1);
  assert.throws(()=>importData(data,'bad'),ImportError);
});

test('review prompt waits for five games and cooldown, then requires unassisted or PB',()=>{
  const records=Array.from({length:5},(_,i)=>rec(`${i}`,i,'easy',true,1000,100));
  assert.equal(shouldPromptReview({},records,1_000_000),false);
  records[0].completedAt=9;records[0].assisted=false;assert.equal(shouldPromptReview({},records,1_000_000),true);
  assert.equal(shouldPromptReview({reviewPromptedAt:1},records,2),false);assert.ok(STORAGE_KEYS.settings);
});
