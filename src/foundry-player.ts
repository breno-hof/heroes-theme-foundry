import type { ThemeCommand } from '@breno-hof/heroes-theme-core';
import type { ThemePlayer } from './bridge-listener.js';

function isPlaylistSound(value: unknown): value is FoundryPlaylistSound {
  return typeof value === 'object' && value !== null && 'parent' in value && 'playing' in value;
}

/**
 * Plays themes through native Foundry playlists. `themeId` is a PlaylistSound
 * UUID (`Playlist.<id>.PlaylistSound.<id>`). Playback state is a document
 * update, so Foundry replicates it to every connected player.
 */
export class FoundryThemePlayer implements ThemePlayer {
  async execute(command: ThemeCommand): Promise<void> {
    const sound = await fromUuid(command.themeId);
    if (!isPlaylistSound(sound) || sound.parent === null) {
      throw new Error(`"${command.themeId}" is not a PlaylistSound UUID`);
    }
    if (command.type === 'theme.play') {
      await sound.update({ volume: command.volume, fade: command.fadeInMs });
      await sound.parent.playSound(sound);
    } else {
      await sound.update({ fade: command.fadeOutMs });
      await sound.parent.stopSound(sound);
    }
  }
}
