import {DEFAULT_SETTINGS,normalizeSettings} from './settings.js';
import {emptyArchive} from './archive.js';
/** Persistent data keys. */
export const STORAGE_KEYS=Object.freeze({settings:'sudoku:v2:settings',archive:'sudoku:v2:archive',records:'sudoku:v2:records',meta:'sudoku:v2:meta'});
const defaults=()=>({schema:2,settings:normalizeSettings(DEFAULT_SETTINGS),archive:emptyArchive(),records:[],meta:{installedAt:Date.now(),completedCount:0,reviewPromptedAt:null,migratedFrom:null}});
/** Migrate legacy v1 saves, leaving source keys untouched. */
export function migrateLegacy(b){let game=null,settings=null;try{const x=b.getItem('sudoku-app:game');if(x){const e=JSON.parse(x);if(e.version===1&&e.game)game=e;}}catch{}try{const x=b.getItem('sudoku-app:settings');if(x)settings=JSON.parse(x);}catch{}if(!game&&!settings)return null;const d=defaults();if(game){const g=game.game;d.archive={activeId:g.id,entries:{[g.id]:{id:g.id,kind:'random',dailyKey:null,difficulty:g.difficulty,createdAt:g.createdAt??game.savedAt,updatedAt:game.savedAt,status:'active',game:g,recovery:[]}}};}if(settings)d.settings=normalizeSettings({colorMode:settings.theme==='auto'?'system':settings.theme});d.meta.migratedFrom=1;return d;}
/** Create a synchronous versioned data store. */
export function createStore(backend){let cache=null;const read=(key,fallback)=>{try{const raw=backend.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch{return fallback;}};const write=(k,v)=>{try{backend.setItem(k,JSON.stringify(v));return true;}catch{return false;}};return {load(){if(cache)return cache;cache=defaults();const migrated=migrateLegacy(backend);if(migrated)cache={...cache,...migrated};else {cache.settings=normalizeSettings(read(STORAGE_KEYS.settings,cache.settings));cache.archive=read(STORAGE_KEYS.archive,cache.archive);cache.records=read(STORAGE_KEYS.records,[]);cache.meta=read(STORAGE_KEYS.meta,cache.meta);}return cache;},saveSettings(s){return write(STORAGE_KEYS.settings,normalizeSettings(s));},saveArchive(a){return write(STORAGE_KEYS.archive,a);},saveRecords(r){return write(STORAGE_KEYS.records,r);},saveMeta(m){return write(STORAGE_KEYS.meta,m);}};}
/** Serialize data for transfer. */
export function exportData(data){return JSON.stringify({format:'sudoku-app-export',version:2,exportedAt:Date.now(),data});}
/** Validate and import exported data. */
export function importData(current,text){let x;try{x=JSON.parse(text);}catch{throw new TypeError('Invalid import');}if(x?.format!=='sudoku-app-export'||x.version!==2||!x.data)throw new TypeError('Invalid import');const data={...current,...x.data};return {data,added:{records:0,entries:0},conflicts:[]};}
/** Whether to show a review request. */
export function shouldPromptReview(meta,records,now=Date.now()){return (records||[]).length>=5&&(meta?.reviewPromptedAt==null||now-meta.reviewPromptedAt>=120*86400000);}
