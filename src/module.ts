import { createJsonLogger } from '@breno-hof/heroes-theme-core';
import { BridgeListener } from './bridge-listener.js';
import { FoundryThemePlayer } from './foundry-player.js';
import {
  MODULE_ID,
  Setting,
  buildThemeConfig,
  getEngineSettings,
  getUserThemes,
  registerSettings,
} from './settings.js';
import { ThemeConfigApp } from './theme-config-app.js';

const logger = createJsonLogger('info', { module: MODULE_ID });

let listener: BridgeListener | null = null;

function applyConfig(): void {
  try {
    listener?.updateConfig(buildThemeConfig(getUserThemes(), getEngineSettings()));
  } catch (error) {
    logger.log('error', 'theme_config_invalid', { error: String(error) });
  }
}

Hooks.once('init', () => {
  registerSettings(applyConfig);
  game.settings.registerMenu(MODULE_ID, 'themeConfigMenu', {
    name: 'HEROESTHEME.Settings.Menu.Name',
    label: 'HEROESTHEME.Settings.Menu.Label',
    hint: 'HEROESTHEME.Settings.Menu.Hint',
    icon: 'fa-solid fa-music',
    type: ThemeConfigApp,
    restricted: true,
  });
});

Hooks.once('ready', () => {
  // One client drives the playlists; Foundry replicates playback to everyone else.
  if (game.users.activeGM?.isSelf !== true) return;

  const url = String(game.settings.get(MODULE_ID, Setting.BridgeUrl) ?? '');
  const token = String(game.settings.get(MODULE_ID, Setting.BridgeToken) ?? '');
  if (url === '' || token === '') {
    ui.notifications.warn(game.i18n.localize('HEROESTHEME.Notify.MissingBridge'));
    return;
  }

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
  } catch (error) {
    logger.log('error', 'startup_failed', { error: String(error) });
    ui.notifications.error(game.i18n.localize('HEROESTHEME.Notify.InvalidConfig'));
  }
});
