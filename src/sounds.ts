import { MODULE_ID } from './constants.js';

const OWNER_FLAG = 'ownerUserId';
/** CONST.PLAYLIST_MODES.DISABLED: sounds are only started individually, never in sequence. */
const SOUNDBOARD_MODE = -1;
/** CONST.DOCUMENT_OWNERSHIP_LEVELS */
const OWNERSHIP = { NONE: 0, OWNER: 3 } as const;

/** Sounds the current user may pick as a theme: `{ uuid: "Playlist / Sound" }`. */
export function availableSounds(): Record<string, string> {
  const sounds: Record<string, string> = {};
  for (const playlist of game.playlists) {
    if (!game.user.isGM && !playlist.testUserPermission(game.user, 'OBSERVER')) continue;
    for (const sound of playlist.sounds) sounds[sound.uuid] = `${playlist.name} / ${sound.name}`;
  }
  return sounds;
}

/** The playlist created for a player to keep their own themes in. */
export function findPlayerPlaylist(userId: string): FoundryPlaylist | undefined {
  for (const playlist of game.playlists) {
    if (playlist.getFlag(MODULE_ID, OWNER_FLAG) === userId) return playlist;
  }
  return undefined;
}

const creating = new Set<string>();

/**
 * GM only. Give each listed player a playlist they own, so they can add their
 * own theme music without being able to touch anyone else's playlists.
 */
export async function ensurePlayerPlaylists(userIds: readonly string[]): Promise<void> {
  for (const userId of userIds) {
    const user = game.users.get(userId);
    if (user === undefined || user.isGM || creating.has(userId) || findPlayerPlaylist(userId)) continue;
    creating.add(userId);
    try {
      await CONFIG.Playlist.documentClass.create({
        name: `Hero's Theme - ${user.name}`,
        mode: SOUNDBOARD_MODE,
        ownership: { default: OWNERSHIP.NONE, [userId]: OWNERSHIP.OWNER },
        flags: { [MODULE_ID]: { [OWNER_FLAG]: userId } },
      });
    } finally {
      creating.delete(userId);
    }
  }
}
