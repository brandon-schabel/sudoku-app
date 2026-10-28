/** Maximum retained unfinished entries. */
export const ARCHIVE_LIMIT=50;
/** Create an empty archive. */
export function emptyArchive(){return {activeId:null,entries:{}};}
/** Save game as active and snapshot recovery at most once per minute. */
export function saveActive(a,g,now=Date.now()){const e={id:g.id,kind:g.kind||'random',dailyKey:g.dailyKey??null,difficulty:g.difficulty,createdAt:g.createdAt??now,updatedAt:now,status:g.completed?'completed':'active',game:g,recovery:[]}; const old=a.entries[g.id]; if(old){e.recovery=old.recovery||[];if(now-(e.recovery.at(-1)?.savedAt??-Infinity)>=60000)e.recovery=[...e.recovery,{savedAt:now,game:old.game}].slice(-3);} return {activeId:g.id,entries:{...a.entries,[g.id]:e}};}
/** Preserve the prior active game and activate the supplied game. */
export function startNew(a,g,now=Date.now()){return saveActive(a,g,now);}
/** Set active entry. */
export function resume(a,id){return a.entries[id]?{...a,activeId:id}:a;}
/** Mark an entry completed. */
export function markCompleted(a,id,now=Date.now()){const e=a.entries[id];return e?{...a,entries:{...a.entries,[id]:{...e,status:'completed',updatedAt:now}}}:a;}
/** List unfinished games newest first. */
export function listUnfinished(a){return Object.values(a.entries).filter(e=>e.status!=='completed').slice().sort((x,y)=>y.updatedAt-x.updatedAt);}
/** Restore a recovery snapshot while preserving current game as recovery. */
export function restoreRecovery(a,id,savedAt){const e=a.entries[id];if(!e)return a; const snap=e.recovery.find(x=>x.savedAt===savedAt);if(!snap)return a;return {...a,activeId:id,entries:{...a.entries,[id]:{...e,game:snap.game,recovery:[...e.recovery,{savedAt:Date.now(),game:e.game}].slice(-3)}}};}
/** Explicitly remove an entry. */
export function removeEntry(a,id){const entries={...a.entries};delete entries[id];return {...a,entries,activeId:a.activeId===id?null:a.activeId};}
