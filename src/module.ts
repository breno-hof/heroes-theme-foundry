import { createJsonLogger } from '@breno-hof/heroes-theme-core';
import { MODULE_ID } from './constants.js';
import { DiscordBridgeSource } from './discord-bridge-source.js';
import { getMood, getPersona } from './flags.js';
import { FoundryAvSource, isAvDisabled } from './foundry-av-source.js';
import { FoundryThemePlayer } from './foundry-player.js';
import { mountMoodWidget, registerMoodWidget } from './mood-widget.js';
import { registerPersonaReporting } from './persona.js';
import {
  buildThemeConfig,
  foundryUserForDiscord,
  getBridge,
  getEngineSettings,
  getUserThemes,
  getVoiceSource,
  participatingUserIds,
  registerSettings,
} from './settings.js';
import { registerSheetControls } from './sheet-controls.js';
import { ensurePlayerPlaylists } from './sounds.js';
import { ThemeConfigApp } from './theme-config-app.js';
import { ThemeEngine, type VoiceSource } from './theme-engine.js';
import { MyThemesApp } from './theme-set-app.js';

const logger = createJsonLogger('info', { module: MODULE_ID });

let engine: ThemeEngine | null = null;
let source: VoiceSource | null = null;

function isDriver(): boolean {
  // One client drives the playlists; Foundry replicates playback to everyone else.
  return game.users.activeGM?.isSelf === true;
}

/**
 * Push everything the state manager depends on: the config (who takes part,
 * each player's themes, each character's themes) and every speaker's current
 * mood and persona. Cheap, so it runs in full whenever any of those change.
 */
function sync(): void {
  mountMoodWidget(); // depends on who takes part
  if (!isDriver()) return;
  try {
    engine?.updateConfig(buildThemeConfig(getUserThemes(), getEngineSettings()));
  } catch (error) {
    logger.log('error', 'theme_config_invalid', { error: String(error) });
  }
  const participants = participatingUserIds();
  for (const foundryUserId of participants) {
    const user = game.users.get(foundryUserId);
    if (user !== undefined) engine?.setContext(foundryUserId, getMood(user), getPersona(user));
  }
  ensurePlayerPlaylists(participants).catch((error: unknown) => {
    logger.log('error', 'playlist_create_failed', { error: String(error) });
  });
}

function notify(level: 'warn' | 'error', key: string): void {
  ui.notifications[level](game.i18n.localize(`HEROESTHEME.Notify.${key}`));
}

/** (Re)start speech detection with the current settings. Only the active GM runs it. */
function start(): void {
  source?.stop();
  source = null;
  engine?.reset();
  engine = null;
  if (!isDriver()) return;

  try {
    engine = new ThemeEngine({
      config: buildThemeConfig(getUserThemes(), getEngineSettings()),
      player: new FoundryThemePlayer(),
      logger,
    });
  } catch (error) {
    logger.log('error', 'startup_failed', { error: String(error) });
    notify('error', 'InvalidConfig');
    return;
  }
  const active = engine;

  if (getVoiceSource() === 'discord') {
    const { url, token } = getBridge();
    if (url === '' || token === '') {
      notify('warn', 'MissingBridge');
      return;
    }
    source = new DiscordBridgeSource({
      url,
      token,
      clientVersion: game.modules.get(MODULE_ID)?.version ?? 'unknown',
      logger,
      onSpeaking: (discordUserId, speaking) => {
        const foundryUserId = foundryUserForDiscord(discordUserId);
        if (foundryUserId !== undefined) active.speaking(foundryUserId, speaking);
      },
      onDisconnect: () => active.reset(),
      onRefused: () => notify('error', 'Refused'),
    });
    source.start();
  } else {
    const av = new FoundryAvSource((foundryUserId, speaking) => active.speaking(foundryUserId, speaking));
    if (isAvDisabled()) notify('warn', 'AvDisabled');
    else if (!av.start()) notify('warn', 'AvUnavailable');
    source = av;
  }
  sync();
}

Hooks.once('init', () => {
  registerSettings(sync, start);
  // `restricted: true` shows this menu to GMs alone.
  game.settings.registerMenu(MODULE_ID, 'themeConfigMenu', {
    name: 'HEROESTHEME.Settings.Menu.Name',
    label: 'HEROESTHEME.Settings.Menu.Label',
    hint: 'HEROESTHEME.Settings.Menu.Hint',
    icon: 'fa-solid fa-music',
    type: ThemeConfigApp,
    restricted: true,
  });
  // The one entry players see: their own mood and themes, nothing about other players.
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
  // New users take part by default with Foundry A/V.
  Hooks.on('createUser', () => resync());

  mountMoodWidget();
  start();
});
