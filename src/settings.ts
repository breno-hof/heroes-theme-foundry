import {
  EngineSettingsSchema,
  parseThemeConfig,
  type EngineSettings,
  type EngineSettingsInput,
  type ThemeConfig,
} from '@breno-hof/heroes-theme-core';

export const MODULE_ID = 'heroes-theme';

/** What the GM configured for one Foundry user. Keyed by Foundry user ID in the `userThemes` setting. */
export interface UserTheme {
  discordUserId: string;
  /** PlaylistSound UUID, or empty for "no theme". */
  themeId: string;
  enabled: boolean;
}
export type UserThemes = Record<string, UserTheme>;

export const Setting = {
  BridgeUrl: 'bridgeUrl',
  BridgeToken: 'bridgeToken',
  UserThemes: 'userThemes',
  Engine: 'engine',
} as const;

export function registerSettings(onConfigChange: () => void, onBridgeChange: () => void): void {
  // Nothing here uses `config: true`: Foundry shows such settings to every
  // player. All of them are edited through ThemeConfigApp, a GM-only menu.
  //
  // Client scope: the URL and token stay in the GM's browser instead of being
  // replicated to every player as world settings would be.
  game.settings.register<string>(MODULE_ID, Setting.BridgeUrl, {
    name: 'Bridge URL',
    scope: 'client',
    config: false,
    type: String,
    default: '',
    onChange: onBridgeChange,
  });
  game.settings.register<string>(MODULE_ID, Setting.BridgeToken, {
    name: 'Bridge token',
    scope: 'client',
    config: false,
    type: String,
    default: '',
    onChange: onBridgeChange,
  });
  // The two world settings below are edited through ThemeConfigApp.
  game.settings.register<UserThemes>(MODULE_ID, Setting.UserThemes, {
    name: 'User themes',
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: onConfigChange,
  });
  game.settings.register<EngineSettingsInput>(MODULE_ID, Setting.Engine, {
    name: 'Engine settings',
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: onConfigChange,
  });
}

export function getBridge(): { url: string; token: string } {
  return {
    url: String(game.settings.get(MODULE_ID, Setting.BridgeUrl) ?? '').trim(),
    token: String(game.settings.get(MODULE_ID, Setting.BridgeToken) ?? '').trim(),
  };
}

export function getUserThemes(): UserThemes {
  return (game.settings.get(MODULE_ID, Setting.UserThemes) ?? {}) as UserThemes;
}

/** Stored engine settings with defaults applied. Falls back to defaults if the stored value is corrupt. */
export function getEngineSettings(): EngineSettings {
  const parsed = EngineSettingsSchema.safeParse(game.settings.get(MODULE_ID, Setting.Engine) ?? {});
  return parsed.success ? parsed.data : EngineSettingsSchema.parse({});
}

/** Combine per-user links and engine settings into a validated core config. Throws `ZodError`. */
export function buildThemeConfig(userThemes: UserThemes, engine: EngineSettingsInput): ThemeConfig {
  const mappings = Object.values(userThemes)
    .filter((entry) => entry.discordUserId !== '' && entry.themeId !== '')
    .map((entry) => ({ discordUserId: entry.discordUserId, themeId: entry.themeId, enabled: entry.enabled }));
  return parseThemeConfig({ settings: engine, mappings });
}
