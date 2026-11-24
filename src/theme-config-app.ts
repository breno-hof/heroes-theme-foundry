import type { EngineSettingsInput } from '@breno-hof/heroes-theme-core';
import { isAvDisabled } from './foundry-av-source.js';
import { availableSounds } from './sounds.js';
import { playersCanUpload, setPlayerUploads } from './uploads.js';
import {
  MODULE_ID,
  Setting,
  buildThemeConfig,
  getBridge,
  getEngineSettings,
  getUserThemes,
  getVoiceSource,
  type UserThemes,
  type VoiceSourceKind,
} from './settings.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** GM-only form: voice source, who takes part with which fallback theme, and trigger timing. */
export class ThemeConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static override DEFAULT_OPTIONS = {
    id: 'heroes-theme-config',
    tag: 'form',
    classes: ['heroes-theme-config'],
    window: {
      title: 'HEROESTHEME.Config.Title',
      icon: 'fa-solid fa-music',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: { width: 820 },
    form: { handler: ThemeConfigApp.#onSubmit, closeOnSubmit: true },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/theme-config.hbs` },
  };

  protected override async _prepareContext(_options: object): Promise<object> {
    const stored = getUserThemes();
    return {
      voiceSource: getVoiceSource(),
      voiceSourceChoices: {
        foundry: 'HEROESTHEME.Config.SourceFoundry',
        discord: 'HEROESTHEME.Config.SourceDiscord',
      },
      avDisabled: isAvDisabled(),
      bridge: getBridge(),
      allowPlayerUploads: playersCanUpload(),
      users: [...game.users].map((user) => ({
        id: user.id,
        name: user.name,
        discordUserId: stored[user.id]?.discordUserId ?? '',
        themeId: stored[user.id]?.themeId ?? '',
        enabled: stored[user.id]?.enabled ?? true,
      })),
      sounds: availableSounds(),
      engine: getEngineSettings(),
      concurrencyChoices: {
        exclusive: 'HEROESTHEME.Config.Exclusive',
        layered: 'HEROESTHEME.Config.Layered',
      },
    };
  }

  protected override _onRender(context: object, options: object): void {
    super._onRender(context, options);
    // Discord-only fields follow the source picker without a re-render, so nothing typed is lost.
    const form = this.element.querySelector<HTMLElement>('.heroes-theme-form');
    const select = this.element.querySelector<HTMLSelectElement>('select[name="voiceSource"]');
    if (form === null || select === null) return;
    const apply = (): void => {
      form.dataset['source'] = select.value;
    };
    select.addEventListener('change', apply);
    apply();
  }

  static async #onSubmit(
    _event: Event,
    _form: HTMLFormElement,
    formData: foundry.applications.ux.FormDataExtended,
  ): Promise<void> {
    const data = foundry.utils.expandObject(formData.object) as {
      voiceSource?: unknown;
      users?: Record<string, { discordUserId?: unknown; themeId?: unknown; enabled?: unknown }>;
      engine?: EngineSettingsInput;
      bridge?: { url?: unknown; token?: unknown };
      allowPlayerUploads?: unknown;
    };
    const source: VoiceSourceKind = data.voiceSource === 'discord' ? 'discord' : 'foundry';
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
      // Validate before saving, so a bad Discord ID or a duplicate never reaches the running state manager.
      buildThemeConfig(userThemes, engine, source);
    } catch (error) {
      console.error(`${MODULE_ID} | invalid configuration`, error);
      ui.notifications.error(game.i18n.localize('HEROESTHEME.Notify.InvalidConfig'));
      throw error; // keeps the form open
    }
    await game.settings.set(MODULE_ID, Setting.UserThemes, userThemes);
    await game.settings.set(MODULE_ID, Setting.Engine, engine);

    const allowUploads = data.allowPlayerUploads === true;
    if (allowUploads !== playersCanUpload()) await setPlayerUploads(allowUploads);

    const current = getBridge();
    const url = String(data.bridge?.url ?? '').trim();
    const token = String(data.bridge?.token ?? '').trim();
    if (url !== current.url) await game.settings.set(MODULE_ID, Setting.BridgeUrl, url);
    if (token !== current.token) await game.settings.set(MODULE_ID, Setting.BridgeToken, token);
    // Always stored once saved, so the choice no longer depends on whether Discord IDs are filled in.
    if (game.settings.get(MODULE_ID, Setting.VoiceSource) !== source) {
      await game.settings.set(MODULE_ID, Setting.VoiceSource, source);
    }
  }
}
