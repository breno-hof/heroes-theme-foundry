import { MOODS, MoodSchema, type ThemeSet } from '@breno-hof/heroes-theme-core';
import { MODULE_ID } from './constants.js';
import { getMood, getThemes, setMood, setThemes } from './flags.js';
import { availableSounds, findPlayerPlaylist } from './sounds.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Whose themes are being edited: a user's own, or a character's. */
export type ThemeTarget = { kind: 'user'; user: FoundryUser } | { kind: 'actor'; actor: FoundryActor };

/**
 * Picks one sound per mood, for a player (their own themes) or for a
 * character sheet. Opened by the player from the mood widget, and by anyone
 * who owns an actor from the sheet's header controls.
 */
export class ThemeSetApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static override DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['heroes-theme-config'],
    window: { icon: 'fa-solid fa-music', resizable: true, contentClasses: ['standard-form'] },
    position: { width: 520 },
    form: { handler: ThemeSetApp.#onSubmit, closeOnSubmit: true },
    actions: { openPlaylist: ThemeSetApp.#onOpenPlaylist },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/theme-set.hbs` },
  };

  readonly #target: ThemeTarget;

  constructor(target: ThemeTarget) {
    const id = target.kind === 'user' ? target.user.id : target.actor.id;
    super({ id: `heroes-theme-set-${target.kind}-${id}` });
    this.#target = target;
  }

  get #document(): FoundryDocument {
    return this.#target.kind === 'user' ? this.#target.user : this.#target.actor;
  }

  override get title(): string {
    const key = this.#target.kind === 'user' ? 'HEROESTHEME.Themes.TitleUser' : 'HEROESTHEME.Themes.TitleActor';
    return `${game.i18n.localize(key)}: ${this.#document.name}`;
  }

  protected override async _prepareContext(_options: object): Promise<object> {
    const themes = getThemes(this.#document);
    const sounds = availableSounds();
    // A theme chosen by someone who can see more playlists (the GM, on a
    // player's character) must survive this user saving the form.
    for (const themeId of Object.values(themes)) {
      sounds[themeId] ??= game.i18n.localize('HEROESTHEME.Themes.KeepCurrent');
    }
    const isUser = this.#target.kind === 'user';
    return {
      isUser,
      mood: isUser ? getMood(this.#target.user) : 'default',
      moodChoices: Object.fromEntries(MOODS.map((mood) => [mood, `HEROESTHEME.Mood.${mood}`])),
      rows: MOODS.map((mood) => ({
        mood,
        label: `HEROESTHEME.Mood.${mood}`,
        themeId: themes[mood] ?? '',
      })),
      sounds,
      hasSounds: Object.keys(sounds).length > 0,
      hasPlaylist: isUser && findPlayerPlaylist(this.#target.user.id) !== undefined,
      canUpload: game.user.can('FILES_UPLOAD'),
      isGM: game.user.isGM,
    };
  }

  static async #onSubmit(
    this: ThemeSetApp,
    _event: Event,
    _form: HTMLFormElement,
    formData: foundry.applications.ux.FormDataExtended,
  ): Promise<void> {
    const data = foundry.utils.expandObject(formData.object) as {
      themes?: Record<string, unknown>;
      mood?: unknown;
    };
    const themes: ThemeSet = {};
    for (const mood of MOODS) {
      const value = data.themes?.[mood];
      if (typeof value === 'string' && value !== '') themes[mood] = value;
    }
    await setThemes(this.#document, themes);

    if (this.#target.kind === 'user') {
      const mood = MoodSchema.safeParse(data.mood);
      if (mood.success) await setMood(this.#target.user, mood.data);
    }
  }

  static #onOpenPlaylist(this: ThemeSetApp): void {
    if (this.#target.kind !== 'user') return;
    findPlayerPlaylist(this.#target.user.id)?.sheet.render({ force: true });
  }
}

/** "My themes", as a settings menu entry: Foundry instantiates menu classes without arguments. */
export class MyThemesApp extends ThemeSetApp {
  constructor() {
    super({ kind: 'user', user: game.user });
  }
}
