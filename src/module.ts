import { createJsonLogger } from '@breno-hof/heroes-theme-core';
import { BridgeListener } from './bridge-listener.js';
import { MODULE_ID } from './constants.js';
import { getMood, getPersona } from './flags.js';
import { FoundryThemePlayer } from './foundry-player.js';
import { mountMoodWidget, registerMoodWidget } from './mood-widget.js';
import { registerPersonaReporting } from './persona.js';
import {
  buildThemeConfig,
  getBridge,
  getEngineSettings,
  getUserThemes,
  linkedUserIds,
  registerSettings,
} from './settings.js';
import { registerSheetControls } from './sheet-controls.js';
import { ensurePlayerPlaylists } from './sounds.js';
import { ThemeConfigApp } from './theme-config-app.js';
import { MyThemesApp } from './theme-set-app.js';

const logger = createJsonLogger('info', { module: MODULE_ID });

let listener: BridgeListener | null = null;

function isDriver(): boolean {
  // One client drives the playlists; Foundry replicates playback to everyone else.
  return game.users.activeGM?.isSelf === true;
}

/**
 * Push everything the state manager depends on: the config (links, each
 * player's themes, each character's themes) and every speaker's current mood
 * and persona. Cheap, so it runs in full whenever any of those change.
 */
function sync(): void {
  mountMoodWidget(); // depends on who is linked
  if (!isDriver()) return;
  try {
    listener?.updateConfig(buildThemeConfig(getUserThemes(), getEngineSettings()));
  } catch (error) {
    logger.log('error', 'theme_config_invalid', { error: String(error) });
  }
  for (const [foundryUserId, entry] of Object.entries(getUserThemes())) {
    const user = game.users.get(foundryUserId);
    if (user === undefined || entry.discordUserId === '') continue;
    listener?.setContext(entry.discordUserId, getMood(user), getPersona(user));
  }
  ensurePlayerPlaylists(linkedUserIds()).catch((error: unknown) => {
    logger.log('error', 'playlist_create_failed', { error: String(error) });
  });
}

/** (Re)connect to the bot with the current bridge settings. Returns false if they are not set yet. */
function startListener(): boolean {
  listener?.stop();
  listener = null;
  if (!isDriver()) return true;

  const { url, token } = getBridge();
  if (url === '' || token === '') return false;

  try {
    listener = new BridgeListener({
      url,
      token,
      clientVersion: game.modules.get(MODULE_ID)?.version ?? 'unknown',
      config: buildThemeConfig(getUserThemes(), getEngineSettings()),
      player: new FoundryThemePlayer(),
      logger,
      onRefused: () => ui.notifications.error(game.i18n.localize('HEROESTHEME.Notify.Refused')),
    });
    listener.start();
    sync();
  } catch (error) {
    logger.log('error', 'startup_failed', { error: String(error) });
    ui.notifications.error(game.i18n.localize('HEROESTHEME.Notify.InvalidConfig'));
  }
  return true;
}

Hooks.once('init', () => {
  registerSettings(sync, () => void startListener());
  // `restricted: true` shows this menu to GMs alone.
  game.settings.registerMenu(MODULE_ID, 'themeConfigMenu', {
    name: 'HEROESTHEME.Settings.Menu.Name',
    label: 'HEROESTHEME.Settings.Menu.Label',
    hint: 'HEROESTHEME.Settings.Menu.Hint',
    icon: 'fa-solid fa-music',
    type: ThemeConfigApp,
    restricted: true,
  });
  // The one entry players see: their own mood and themes, nothing about the bridge or other players.
  game.settings.registerMenu(MODULE_ID, 'myThemesMenu', {
    name: 'HEROESTHEME.Settings.MyThemes.Name',
    label: 'HEROESTHEME.Settings.MyThemes.Label',
    hint: 'HEROESTHEME.Settings.MyThemes.Hint',
    icon: 'fa-solid fa-masks-theater',
    type: MyThemesApp,
    restricted: false,
  });
  registerMoodWidget();
  registerSheetControls();
});

Hooks.once('ready', () => {
  registerPersonaReporting();

  // Moods, personas and themes live in user and actor flags; follow their changes.
  const resync = foundry.utils.debounce(sync, 50);
  const onUpdate = (_document: unknown, changes: unknown): void => {
    if (typeof changes === 'object' && changes !== null && ('flags' in changes || 'character' in changes)) resync();
  };
  Hooks.on('updateUser', onUpdate);
  Hooks.on('updateActor', onUpdate);
  Hooks.on('deleteActor', () => resync());

  mountMoodWidget();
  if (!startListener()) ui.notifications.warn(game.i18n.localize('HEROESTHEME.Notify.MissingBridge'));
});
