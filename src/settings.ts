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
import { speakerKey } from './theme-engine.js';

export { MODULE_ID };

/** What the GM configured for one Foundry user. Keyed by Foundry user ID in the `userThemes` setting. */
export interface UserTheme {
  /** Only used with the Discord voice source. Kept when switching sources so nothing has to be retyped. */
  discordUserId: string;
  /** Fallback PlaylistSound UUID chosen by the GM, used when the player picked no theme of their own. Empty for none. */
  themeId: string;
  enabled: boolean;
}
export type UserThemes = Record<string, UserTheme>;

/** Where speech is detected. `foundry`: Foundry's built-in A/V chat. `discord`: the optional Discord bridge. */
export type VoiceSourceKind = 'foundry' | 'discord';

export const Setting = {
  VoiceSource: 'voiceSource',
  BridgeUrl: 'bridgeUrl',
  BridgeToken: 'bridgeToken',
  UserThemes: 'userThemes',
  Engine: 'engine',
} as const;

export function registerSettings(onConfigChange: () => void, onSourceChange: () => void): void {
  // Nothing here uses `config: true`: Foundry shows such settings to every
  // player. All of them are edited through ThemeConfigApp, a GM-only menu.
  //
  // Empty means "never chosen": see `getVoiceSource`.
  game.settings.register<string>(MODULE_ID, Setting.VoiceSource, {
    name: 'Voice source',
    scope: 'world',
    config: false,
    type: String,
    default: '',
    onChange: onSourceChange,
  });
  // Client scope: the URL and token stay in the GM's browser instead of being
  // replicated to every player as world settings would be.
  game.settings.register<string>(MODULE_ID, Setting.BridgeUrl, {
    name: 'Bridge URL',
    scope: 'client',
    config: false,
    type: String,
    default: '',
    onChange: onSourceChange,
  });
  game.settings.register<string>(MODULE_ID, Setting.BridgeToken, {
    name: 'Bridge token',
    scope: 'client',
    config: false,
    type: String,
    default: '',
    onChange: onSourceChange,
  });
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

/**
 * The voice source in use. Worlds set up before Foundry A/V was supported
 * never chose one; if they already link players to Discord they keep using
 * Discord, so nobody has to reconfigure anything. Everyone else gets Foundry A/V.
 */
export function getVoiceSource(): VoiceSourceKind {
  const stored = game.settings.get(MODULE_ID, Setting.VoiceSource);
  if (stored === 'foundry' || stored === 'discord') return stored;
  return Object.values(getUserThemes()).some((entry) => entry.discordUserId !== '') ? 'discord' : 'foundry';
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
 * Foundry users who can trigger a theme: everyone the GM has not switched
 * off, and with the Discord source only those linked to a Discord account.
 */
export function participatingUserIds(
  userThemes: UserThemes = getUserThemes(),
  source: VoiceSourceKind = getVoiceSource(),
): string[] {
  const ids: string[] = [];
  for (const user of game.users) {
    const entry = userThemes[user.id];
    if (entry?.enabled === false) continue;
    if (source === 'discord' && (entry?.discordUserId ?? '') === '') continue;
    ids.push(user.id);
  }
  return ids;
}

const DISCORD_ID = /^\d{15,22}$/;

/** Throws if a Discord ID is malformed or shared by two users. Only matters with the Discord source. */
export function validateDiscordIds(userThemes: UserThemes): void {
  const seen = new Set<string>();
  for (const entry of Object.values(userThemes)) {
    if (entry.discordUserId === '') continue;
    if (!DISCORD_ID.test(entry.discordUserId)) throw new Error(`invalid Discord user ID "${entry.discordUserId}"`);
    if (seen.has(entry.discordUserId)) throw new Error(`Discord user ID "${entry.discordUserId}" is used twice`);
    seen.add(entry.discordUserId);
  }
}

/**
 * Combine the GM's settings, each player's own themes and the themes set on
 * character sheets into a validated core config. Throws on invalid input.
 */
export function buildThemeConfig(
  userThemes: UserThemes,
  engine: EngineSettingsInput,
  source: VoiceSourceKind = getVoiceSource(),
): ThemeConfig {
  if (source === 'discord') validateDiscordIds(userThemes);

  // Every speaker gets every character's themes; which one applies is decided
  // at runtime by the persona reported for that speaker.
  const personas: Record<string, ThemeSet> = {};
  for (const actor of game.actors) {
    const themes = getThemes(actor);
    if (Object.keys(themes).length > 0) personas[actor.id] = themes;
  }

  const mappings: ThemeMappingInput[] = [];
  for (const foundryUserId of participatingUserIds(userThemes, source)) {
    const user = game.users.get(foundryUserId);
    const themeId = userThemes[foundryUserId]?.themeId ?? '';
    mappings.push({
      discordUserId: speakerKey(foundryUserId),
      enabled: true,
      themes: user ? getThemes(user) : {},
      personas,
      ...(themeId !== '' ? { themeId } : {}),
    });
  }
  return parseThemeConfig({ settings: engine, mappings });
}

/** With the Discord source: the Foundry user linked to a Discord account. */
export function foundryUserForDiscord(discordUserId: string): string | undefined {
  for (const [foundryUserId, entry] of Object.entries(getUserThemes())) {
    if (entry.discordUserId === discordUserId) return foundryUserId;
  }
  return undefined;
}
