import type { EngineSettingsInput } from '@breno-hof/heroes-theme-core';
import {
  MODULE_ID,
  Setting,
  buildThemeConfig,
  getEngineSettings,
  getUserThemes,
  type UserThemes,
} from './settings.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** GM-only form linking each Foundry user to a Discord account and a playlist sound. */
export class ThemeConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static override DEFAULT_OPTIONS = {
    id: 'heroes-theme-config',
    tag: 'form',
    classes: ['heroes-theme-config', 'standard-form'],
    window: { title: 'HEROESTHEME.Config.Title', icon: 'fa-solid fa-music', contentClasses: ['standard-form'] },
    position: { width: 640 },
    form: { handler: ThemeConfigApp.#onSubmit, closeOnSubmit: true },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/theme-config.hbs` },
  };

  protected override async _prepareContext(_options: object): Promise<object> {
    const stored = getUserThemes();
    const sounds: Record<string, string> = {};
    for (const playlist of game.playlists) {
      for (const sound of playlist.sounds) sounds[sound.uuid] = `${playlist.name} / ${sound.name}`;
    }
    return {
      users: [...game.users].map((user) => ({
        id: user.id,
        name: user.name,
        discordUserId: stored[user.id]?.discordUserId ?? '',
        themeId: stored[user.id]?.themeId ?? '',
        enabled: stored[user.id]?.enabled ?? true,
      })),
      sounds,
      engine: getEngineSettings(),
      concurrencyChoices: {
        exclusive: 'HEROESTHEME.Config.Exclusive',
        layered: 'HEROESTHEME.Config.Layered',
      },
    };
  }

  static async #onSubmit(
    _event: Event,
    _form: HTMLFormElement,
    formData: foundry.applications.ux.FormDataExtended,
  ): Promise<void> {
    const data = foundry.utils.expandObject(formData.object) as {
      users?: Record<string, { discordUserId?: unknown; themeId?: unknown; enabled?: unknown }>;
      engine?: EngineSettingsInput;
    };
    const userThemes: UserThemes = {};
    for (const [userId, entry] of Object.entries(data.users ?? {})) {
      userThemes[userId] = {
        discordUserId: String(entry.discordUserId ?? '').trim(),
        themeId: String(entry.themeId ?? ''),
        enabled: entry.enabled === true,
      };
    }
    const engine = data.engine ?? {};

    try {
      // Validate with the core before saving, so a bad Discord ID or a
      // duplicate never reaches the running state manager.
      buildThemeConfig(userThemes, engine);
    } catch (error) {
      console.error(`${MODULE_ID} | invalid configuration`, error);
      ui.notifications.error(game.i18n.localize('HEROESTHEME.Notify.InvalidConfig'));
      throw error; // keeps the form open
    }
    await game.settings.set(MODULE_ID, Setting.UserThemes, userThemes);
    await game.settings.set(MODULE_ID, Setting.Engine, engine);
  }
}
