import type { VoiceSource } from './theme-engine.js';

type SpeakingCallback = (foundryUserId: string, speaking: boolean) => void;

const listeners = new Set<SpeakingCallback>();
let patched = false;

/**
 * Foundry lights up a user's camera dock whenever they speak, through
 * `CameraViews#setUserIsSpeaking`. Every client calls it for every user: for
 * its own user from local voice detection or push-to-talk, and for everyone
 * else from the A/V activity they broadcast. Following that call means themes
 * follow exactly what Foundry itself shows as speaking.
 */
function patchCameraViews(): boolean {
  if (patched) return true;
  const cls = foundry.applications.apps?.av?.CameraViews;
  const proto = (cls?.prototype ?? (ui.webrtc ? Object.getPrototypeOf(ui.webrtc) : undefined)) as
    | { setUserIsSpeaking?: (this: unknown, userId: string, speaking: boolean) => unknown }
    | undefined;
  const original = proto?.setUserIsSpeaking;
  if (proto === undefined || typeof original !== 'function') return false;
  proto.setUserIsSpeaking = function (this: unknown, userId: string, speaking: boolean) {
    const result = original.call(this, userId, speaking);
    for (const listener of listeners) {
      try {
        listener(userId, speaking === true);
      } catch (error) {
        console.error('heroes-theme | speaking listener failed', error);
      }
    }
    return result;
  };
  patched = true;
  return true;
}

/** Speech detection from Foundry's built-in audio/video chat. No external service involved. */
export class FoundryAvSource implements VoiceSource {
  readonly #onSpeaking: SpeakingCallback;
  readonly #speaking = new Set<string>();
  #listener: SpeakingCallback | null = null;
  #connectionHook: number | null = null;

  constructor(onSpeaking: SpeakingCallback) {
    this.#onSpeaking = onSpeaking;
  }

  /** Returns false if Foundry's camera dock is unavailable, so speech cannot be followed. */
  start(): boolean {
    if (this.#listener !== null) return true;
    if (!patchCameraViews()) return false;
    // Foundry repeats the same state; only pass on actual changes.
    this.#listener = (userId, speaking) => {
      if (speaking === this.#speaking.has(userId)) return;
      if (speaking) this.#speaking.add(userId);
      else this.#speaking.delete(userId);
      this.#onSpeaking(userId, speaking);
    };
    listeners.add(this.#listener);
    // Someone who drops mid-sentence never reports going quiet.
    this.#connectionHook = Hooks.on('userConnected', (user, connected) => {
      const id = (user as { id?: unknown }).id;
      if (connected === false && typeof id === 'string') this.#listener?.(id, false);
    });
    return true;
  }

  stop(): void {
    if (this.#listener !== null) listeners.delete(this.#listener);
    this.#listener = null;
    if (this.#connectionHook !== null) Hooks.off('userConnected', this.#connectionHook);
    this.#connectionHook = null;
    this.#speaking.clear();
  }
}

/** CONST.AV_MODES.DISABLED */
const AV_MODE_DISABLED = 0;

/** Whether the world has Foundry's audio/video chat turned off. */
export function isAvDisabled(): boolean {
  const world = game.settings.get('core', 'rtcWorldSettings') as { mode?: unknown } | undefined;
  return world?.mode === AV_MODE_DISABLED;
}
