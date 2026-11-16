/**
 * Minimal ambient declarations for the parts of the Foundry VTT v14 client
 * API this module touches. Hand-written and deliberately narrow; replace with
 * full community typings once they cover v14.
 */

interface FoundrySettingConfig<T> {
  name: string;
  hint?: string;
  scope: 'world' | 'client';
  config: boolean;
  type: unknown;
  default: T;
  requiresReload?: boolean;
  onChange?: (value: T) => void;
}

interface FoundrySettingMenuConfig {
  name: string;
  label: string;
  hint?: string;
  icon: string;
  type: unknown;
  restricted: boolean;
}

interface FoundryPlaylistSound {
  readonly uuid: string;
  readonly name: string;
  readonly playing: boolean;
  readonly parent: FoundryPlaylist | null;
  update(data: { volume?: number; fade?: number }): Promise<unknown>;
}

interface FoundryPlaylist {
  readonly name: string;
  readonly sounds: Iterable<FoundryPlaylistSound>;
  playSound(sound: FoundryPlaylistSound): Promise<unknown>;
  stopSound(sound: FoundryPlaylistSound): Promise<unknown>;
}

interface FoundryUser {
  readonly id: string;
  readonly name: string;
  readonly isSelf: boolean;
}

declare const game: {
  settings: {
    register<T>(namespace: string, key: string, config: FoundrySettingConfig<T>): void;
    registerMenu(namespace: string, key: string, config: FoundrySettingMenuConfig): void;
    get(namespace: string, key: string): unknown;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
  };
  users: Iterable<FoundryUser> & { activeGM: FoundryUser | null };
  playlists: Iterable<FoundryPlaylist>;
  modules: { get(id: string): { version: string } | undefined };
  i18n: { localize(key: string): string };
};

declare const Hooks: {
  once(hook: string, callback: () => void): void;
  on(hook: string, callback: (...args: unknown[]) => void): void;
};

declare const ui: {
  notifications: {
    warn(message: string): void;
    error(message: string): void;
  };
};

declare function fromUuid(uuid: string): Promise<unknown>;

declare namespace foundry {
  namespace applications.api {
    class ApplicationV2 {
      static DEFAULT_OPTIONS: object;
      constructor(options?: object);
      render(options?: { force?: boolean }): Promise<this>;
      close(): Promise<this>;
      protected _prepareContext(options: object): Promise<object>;
    }
    function HandlebarsApplicationMixin<T extends typeof ApplicationV2>(base: T): T;
  }
  namespace applications.ux {
    class FormDataExtended {
      readonly object: Record<string, unknown>;
    }
  }
  namespace utils {
    function expandObject(object: Record<string, unknown>): Record<string, unknown>;
  }
}
