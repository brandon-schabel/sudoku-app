/** Maximum retained unfinished entries. */
export const ARCHIVE_LIMIT = 50;

/** Opaque game state retained by the domain. @typedef {Record<string, unknown>} GameJSON */
/** @typedef {{id:string,kind:'random'|'daily',dailyKey:string|null,difficulty:'easy'|'medium'|'hard'|'expert',createdAt:number,updatedAt:number,status:'active'|'completed',game:GameJSON,recovery:Array<{savedAt:number,game:GameJSON}>}} ArchiveEntry */
/** @typedef {{activeId:string|null,entries:Record<string,ArchiveEntry>}} Archive */

const clone = value => structuredClone(value);

/** Create an empty archive. */
export function emptyArchive() {
  return { activeId: null, entries: {} };
}

/** Prune completed entries when the archive exceeds its retained-entry limit. */
export function pruneArchive(archive) {
  const entries = { ...archive.entries };
  while (Object.keys(entries).length > ARCHIVE_LIMIT) {
    const oldestCompleted = Object.values(entries)
      .filter(entry => entry.status === 'completed' && entry.id !== archive.activeId)
      .sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (!oldestCompleted) break;
    delete entries[oldestCompleted.id];
  }
  return { ...archive, entries };
}

function requireGameId(game) {
  if (!game || typeof game !== 'object' || typeof game.id !== 'string' || !game.id) {
    throw new TypeError('A game with a non-empty string id is required.');
  }
}

/** Save game as active and snapshot recovery at most once per minute. */
export function saveActive(archive, game, now = Date.now()) {
  requireGameId(game);
  const entries = { ...archive.entries };
  const old = entries[game.id];
  const savedGame = clone(game);
  const recovery = (old?.recovery ?? []).map(snapshot => ({
    savedAt: snapshot.savedAt,
    game: clone(snapshot.game)
  }));
  const kind = game.kind ?? old?.kind;
  if (kind !== 'random' && kind !== 'daily') throw new TypeError('Game kind must be random or daily.');

  if (old && JSON.stringify(old.game) !== JSON.stringify(game) && now - (recovery.at(-1)?.savedAt ?? old.updatedAt ?? -Infinity) >= 60000) {
    recovery.push({ savedAt: now, game: clone(old.game) });
  }

  entries[game.id] = {
    id: game.id,
    kind,
    dailyKey: game.dailyKey ?? null,
    difficulty: game.difficulty,
    createdAt: game.createdAt ?? old?.createdAt ?? now,
    updatedAt: now,
    status: game.completed ? 'completed' : 'active',
    game: savedGame,
    recovery: recovery.slice(-3)
  };
  return pruneArchive({ activeId: game.id, entries });
}

/** Preserve the prior active game and activate the supplied game. */
export function startNew(archive, game, now = Date.now()) {
  return saveActive(archive, game, now);
}

/** Set active entry. */
export function resume(archive, id) {
  if (!Object.hasOwn(archive.entries, id)) throw new RangeError(`Unknown archive entry: ${id}`);
  return { ...archive, activeId: id, entries: { ...archive.entries } };
}

/** Mark an entry completed. */
export function markCompleted(archive, id, now = Date.now()) {
  const entry = archive.entries[id];
  if (!entry) throw new RangeError(`Unknown archive entry: ${id}`);
  const game = { ...clone(entry.game), completed: true };
  return {
    ...archive,
    activeId: archive.activeId === id ? null : archive.activeId,
    entries: { ...archive.entries, [id]: { ...entry, status: 'completed', updatedAt: now, game } }
  };
}

/** List unfinished games newest first. */
export function listUnfinished(archive) {
  return Object.values(archive.entries)
    .filter(entry => entry.status !== 'completed')
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Restore a recovery snapshot while preserving current game as recovery. */
export function restoreRecovery(archive, id, savedAt, now = Date.now()) {
  const entry = archive.entries[id];
  const snapshot = entry?.recovery.find(item => item.savedAt === savedAt);
  if (!snapshot) return { ...archive, entries: { ...archive.entries } };

  const recovery = [
    { savedAt: now, game: clone(entry.game) },
    ...entry.recovery.filter(item => item.savedAt !== savedAt).map(item => ({ savedAt: item.savedAt, game: clone(item.game) }))
  ].slice(0, 3);
  return {
    ...archive,
    activeId: snapshot.game.completed ? null : id,
    entries: {
      ...archive.entries,
      [id]: {
        ...entry,
        status: snapshot.game.completed ? 'completed' : 'active',
        game: clone(snapshot.game),
        updatedAt: now,
        recovery
      }
    }
  };
}

/** Explicitly remove an entry. */
export function removeEntry(archive, id) {
  const entries = { ...archive.entries };
  delete entries[id];
  return { ...archive, entries, activeId: archive.activeId === id ? null : archive.activeId };
}
