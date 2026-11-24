import {
  ThemeStateManager,
  type Logger,
  type Mood,
  type ThemeCommand,
  type ThemeConfigInput,
} from '@breno-hof/heroes-theme-core';

/** Executes theme commands against a specific VTT. */
export interface ThemePlayer {
  execute(command: ThemeCommand): Promise<void>;
}

/**
 * The core identifies speakers by a numeric ID (it was written for Discord
 * snowflakes). Each Foundry user gets one here, stable for the lifetime of the
 * page, which is as long as the state manager lives.
 */
const speakerKeys = new Map<string, string>();
const SPEAKER_KEY_BASE = 100_000_000_000_000_000n;

export function speakerKey(foundryUserId: string): string {
  let key = speakerKeys.get(foundryUserId);
  if (key === undefined) {
    key = String(SPEAKER_KEY_BASE + BigInt(speakerKeys.size));
    speakerKeys.set(foundryUserId, key);
  }
  return key;
}

/**
 * Wraps the core `ThemeStateManager`, keyed by Foundry user ID. Whatever
 * detects speech (Foundry A/V or the Discord bridge) reports it here.
 */
export class ThemeEngine {
  readonly #manager: ThemeStateManager;

  constructor(options: { config: ThemeConfigInput; player: ThemePlayer; logger: Logger }) {
    const { player, logger } = options;
    this.#manager = new ThemeStateManager({ config: options.config, logger });
    this.#manager.onCommand((command) => {
      player.execute(command).catch((error: unknown) => {
        logger.log('error', 'theme_command_failed', { command: command.type, error: String(error) });
      });
    });
  }

  speaking(foundryUserId: string, speaking: boolean): void {
    this.#manager.handleSpeaking(speakerKey(foundryUserId), speaking);
  }

  /** Throws `ZodError` if the config is invalid; the previous config stays in effect. */
  updateConfig(config: ThemeConfigInput): void {
    this.#manager.updateConfig(config);
  }

  /** Tell the state manager what mood a speaker is in and which character they are voicing. */
  setContext(foundryUserId: string, mood: Mood, persona: string | null): void {
    const key = speakerKey(foundryUserId);
    this.#manager.setMood(key, mood);
    this.#manager.setPersona(key, persona);
  }

  /** Stop every theme. Used when speaking state becomes unknown. */
  reset(): void {
    this.#manager.reset();
  }
}

/** Something that reports who is speaking. */
export interface VoiceSource {
  start(): void;
  stop(): void;
}
