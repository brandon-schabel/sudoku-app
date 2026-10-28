/** Maximum retained unfinished entries. */
export const ARCHIVE_LIMIT=50;
/** Opaque game state retained without modification by the domain. @typedef {Record<string,unknown>} GameJSON */
/** @typedef {{id:string,kind:'random'|'daily',dailyKey:string|null,difficulty:'easy'|'medium'|'hard'|'expert',createdAt:number,updatedAt:number,status:'active'|'completed',game:GameJSON,recovery:Array<{savedAt:number,game:GameJSON}>}} ArchiveEntry */
/** @typedef {{activeId:string|null,entries:Record<string,ArchiveEntry>}} Archive */
/** Create an empty archive. */
export function emptyArchive(){return {activeId:null,entries:{}};}
/** Save game as active and snapshot recovery at most once per minute. */
export function saveActive(a,g,now=Date.now()){const entries={...a.entries};const old=entries[g.id];const e={id:g.id,kind:g.kind||'random',dailyKey:g.dailyKey??null,difficulty:g.difficulty,createdAt:g.createdAt??now,updatedAt:now,status:g.completed?'completed':'active',game:g,recovery:old?.recovery||[]}; if(old&&now-(e.recovery.at(-1)?.savedAt??-Infinity)>=60000)e.recovery=[...e.recovery,{savedAt:now,game:old.game}].slice(-3);entries[g.id]=e;while(Object.keys(entries).length>ARCHIVE_LIMIT){const prunable=Object.values(entries).filter(entry=>entry.status==='completed'&&entry.id!==g.id).sort((x,y)=>x.updatedAt-y.updatedAt)[0];if(!prunable)break;delete entries[prunable.id];}return {activeId:g.id,entries};}
/** Preserve the prior active game and activate the supplied game. */
export function startNew(a,g,now=Date.now()){return saveActive(a,g,now);}
/** Set active entry. */
export function resume(a,id){return {...a,activeId:a.entries[id]?id:a.activeId,entries:{...a.entries}};}
/** Mark an entry completed. */
export function markCompleted(a,id,now=Date.now()){const e=a.entries[id];return e?{...a,entries:{...a.entries,[id]:{...e,status:'completed',updatedAt:now}}}:{...a,entries:{...a.entries}};}
/** List unfinished games newest first. */
export function listUnfinished(a){return Object.values(a.entries).filter(e=>e.status!=='completed').slice().sort((x,y)=>y.updatedAt-x.updatedAt);}
/** Restore a recovery snapshot while preserving current game as recovery. */
export function restoreRecovery(a,id,savedAt){const e=a.entries[id];if(!e)return {...a,entries:{...a.entries}}; const snap=e.recovery.find(x=>x.savedAt===savedAt);if(!snap)return {...a,entries:{...a.entries}};return {...a,activeId:id,entries:{...a.entries,[id]:{...e,game:snap.game,recovery:[...e.recovery,{savedAt,game:e.game}].slice(-3)}}};}
/** Explicitly remove an entry. */
export function removeEntry(a,id){const entries={...a.entries};delete entries[id];return {...a,entries,activeId:a.activeId===id?null:a.activeId};}
