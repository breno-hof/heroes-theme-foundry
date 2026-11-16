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

interface FoundryDocument {
  readonly id: string;
  readonly name: string;
  readonly uuid: string;
  readonly isOwner: boolean;
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  testUserPermission(user: FoundryUser, level: 'OBSERVER' | 'OWNER'): boolean;
}

interface FoundryUser extends FoundryDocument {
  readonly isSelf: boolean;
  readonly isGM: boolean;
  /** The character assigned to this user in the player configuration. */
  readonly character: FoundryActor | null;
  can(permission: string): boolean;
}

interface FoundryActor extends FoundryDocument {
  readonly documentName: 'Actor';
  /** Whether any non-GM user owns this actor. */
  readonly hasPlayerOwner: boolean;
}

interface FoundryPlaylistSound {
  readonly uuid: string;
  readonly name: string;
  readonly playing: boolean;
  readonly parent: FoundryPlaylist | null;
  update(data: { volume?: number; fade?: number; repeat?: boolean }): Promise<unknown>;
}

interface FoundryPlaylist extends FoundryDocument {
  readonly sounds: Iterable<FoundryPlaylistSound>;
  readonly sheet: { render(options: { force: boolean }): unknown };
  playSound(sound: FoundryPlaylistSound): Promise<unknown>;
  stopSound(sound: FoundryPlaylistSound): Promise<unknown>;
}

interface FoundryCollection<T> extends Iterable<T> {
  get(id: string): T | undefined;
}

declare const game: {
  settings: {
    register<T>(namespace: string, key: string, config: FoundrySettingConfig<T>): void;
    registerMenu(namespace: string, key: string, config: FoundrySettingMenuConfig): void;
    get(namespace: string, key: string): unknown;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
  };
  user: FoundryUser;
  users: FoundryCollection<FoundryUser> & { activeGM: FoundryUser | null };
  actors: FoundryCollection<FoundryActor>;
  playlists: FoundryCollection<FoundryPlaylist>;
  modules: { get(id: string): { version: string } | undefined };
  i18n: { localize(key: string): string };
};

declare const canvas: { tokens?: { controlled: Array<{ actor: FoundryActor | null }> } } | undefined;

declare const CONFIG: {
  Playlist: { documentClass: { create(data: object): Promise<FoundryPlaylist> } };
};

declare const Hooks: {
  once(hook: string, callback: (...args: unknown[]) => void): void;
  on(hook: string, callback: (...args: unknown[]) => void): void;
};

declare const ui: {
  notifications: {
    info(message: string): void;
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
      get title(): string;
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
    function deepClone<T>(value: T): T;
    function debounce<A extends unknown[]>(callback: (...args: A) => void, delayMs: number): (...args: A) => void;
  }
}
