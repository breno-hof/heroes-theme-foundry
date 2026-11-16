import {
  EngineSettingsSchema,
  parseThemeConfig,
  type EngineSettings,
  type EngineSettingsInput,
  type ThemeConfig,
  type ThemeMappingInput,
  type ThemeSet,
} from '@breno-hof/heroes-theme-core';
import { MODULE_ID } from './constants.js';
import { getThemes } from './flags.js';

export { MODULE_ID };

/** What the GM configured for one Foundry user. Keyed by Foundry user ID in the `userThemes` setting. */
export interface UserTheme {
  discordUserId: string;
  /** Fallback PlaylistSound UUID chosen by the GM, used when the player picked no theme of their own. Empty for none. */
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

/**
 * Combine the GM's links, each player's own themes and the themes set on
 * character sheets into a validated core config. Throws `ZodError`.
 */
export function buildThemeConfig(userThemes: UserThemes, engine: EngineSettingsInput): ThemeConfig {
  // Every speaker gets every character's themes; which one applies is decided
  // at runtime by the persona reported for that speaker.
  const personas: Record<string, ThemeSet> = {};
  for (const actor of game.actors) {
    const themes = getThemes(actor);
    if (Object.keys(themes).length > 0) personas[actor.id] = themes;
  }

  const mappings: ThemeMappingInput[] = [];
  for (const [foundryUserId, entry] of Object.entries(userThemes)) {
    if (entry.discordUserId === '') continue;
    const user = game.users.get(foundryUserId);
    mappings.push({
      discordUserId: entry.discordUserId,
      enabled: entry.enabled,
      themes: user ? getThemes(user) : {},
      personas,
      ...(entry.themeId !== '' ? { themeId: entry.themeId } : {}),
    });
  }
  return parseThemeConfig({ settings: engine, mappings });
}

/** Foundry user IDs linked to a Discord account. */
export function linkedUserIds(): string[] {
  return Object.entries(getUserThemes())
    .filter(([, entry]) => entry.discordUserId !== '')
    .map(([userId]) => userId);
}
