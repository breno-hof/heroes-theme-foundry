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

interface FoundryPlaylistSound {
  readonly uuid: string;
  readonly name: string;
  readonly playing: boolean;
  readonly parent: FoundryPlaylist | null;
  update(data: { volume?: number; fade?: number }): Promise<unknown>;
}

interface FoundryPlaylist {
  playSound(sound: FoundryPlaylistSound): Promise<unknown>;
  stopSound(sound: FoundryPlaylistSound): Promise<unknown>;
}

declare const game: {
  settings: {
    register<T>(namespace: string, key: string, config: FoundrySettingConfig<T>): void;
    get(namespace: string, key: string): unknown;
  };
  users: { activeGM: { isSelf: boolean } | null };
  modules: { get(id: string): { version: string } | undefined };
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
