import { createJsonLogger, type ThemeConfigInput } from '@breno-hof/heroes-theme-core';
import { BridgeListener } from './bridge-listener.js';
import { FoundryThemePlayer } from './foundry-player.js';

const MODULE_ID = 'heroes-theme';
const logger = createJsonLogger('info', { module: MODULE_ID });

let listener: BridgeListener | null = null;

Hooks.once('init', () => {
  // Client scope: the URL and token stay in the GM's browser instead of being
  // replicated to every player as world settings would be.
  game.settings.register<string>(MODULE_ID, 'bridgeUrl', {
    name: 'Bridge URL',
    hint: 'WebSocket URL of heroes-theme-bot, e.g. wss://bot.example.com. Only the GM connects.',
    scope: 'client',
    config: true,
    type: String,
    default: '',
    requiresReload: true,
  });
  game.settings.register<string>(MODULE_ID, 'bridgeToken', {
    name: 'Bridge token',
    hint: 'The HT_WS_TOKEN configured on the bot.',
    scope: 'client',
    config: true,
    type: String,
    default: '',
    requiresReload: true,
  });
  // Edited through a config application (ApplicationV2) in a later iteration.
  game.settings.register<ThemeConfigInput>(MODULE_ID, 'themeConfig', {
    name: 'Theme configuration',
    scope: 'world',
    config: false,
    type: Object,
    default: { mappings: [] },
    onChange: (value) => {
      try {
        listener?.updateConfig(value);
      } catch (error) {
        logger.log('error', 'theme_config_invalid', { error: String(error) });
      }
    },
  });
});

Hooks.once('ready', () => {
  // One client drives the playlists; Foundry replicates playback to everyone else.
  if (game.users.activeGM?.isSelf !== true) return;

  const url = String(game.settings.get(MODULE_ID, 'bridgeUrl') ?? '');
  const token = String(game.settings.get(MODULE_ID, 'bridgeToken') ?? '');
  if (url === '' || token === '') {
    ui.notifications.warn("Hero's Theme: set the bridge URL and token in the module settings.");
    return;
  }

  try {
    listener = new BridgeListener({
      url,
      token,
      clientVersion: game.modules.get(MODULE_ID)?.version ?? 'unknown',
      config: game.settings.get(MODULE_ID, 'themeConfig') as ThemeConfigInput,
      player: new FoundryThemePlayer(),
      logger,
    });
    listener.start();
  } catch (error) {
    logger.log('error', 'startup_failed', { error: String(error) });
    ui.notifications.error("Hero's Theme: invalid theme configuration, see the console.");
  }
});
