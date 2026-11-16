import {
  CloseCode,
  ThemeStateManager,
  createHello,
  decodeServerMessage,
  encodeMessage,
  type Logger,
  type ThemeCommand,
  type ThemeConfigInput,
} from '@breno-hof/heroes-theme-core';

/** Executes theme commands against a specific VTT. */
export interface ThemePlayer {
  execute(command: ThemeCommand): Promise<void>;
}

export interface BridgeListenerOptions {
  url: string;
  token: string;
  clientVersion: string;
  config: ThemeConfigInput;
  player: ThemePlayer;
  logger: Logger;
  /** Called once when the bot rejects the token or protocol version; the listener stops retrying. */
  onRefused?: () => void;
}

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
/** Close codes that will fail again identically, so retrying is pointless. */
const FATAL_CLOSE_CODES: ReadonlySet<number> = new Set([CloseCode.Unauthorized, CloseCode.UnsupportedVersion]);

/**
 * Keeps a WebSocket open to heroes-theme-bot, feeds speaking events into the
 * core state manager and hands the resulting commands to a `ThemePlayer`.
 */
export class BridgeListener {
  readonly #options: BridgeListenerOptions;
  readonly #manager: ThemeStateManager;
  #socket: WebSocket | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #attempt = 0;
  #stopped = true;

  constructor(options: BridgeListenerOptions) {
    this.#options = options;
    this.#manager = new ThemeStateManager({ config: options.config, logger: options.logger });
    this.#manager.onCommand((command) => {
      options.player.execute(command).catch((error: unknown) => {
        options.logger.log('error', 'theme_command_failed', { command: command.type, error: String(error) });
      });
    });
  }

  start(): void {
    if (!this.#stopped) return;
    this.#stopped = false;
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    clearTimeout(this.#reconnectTimer);
    this.#socket?.close(1000, 'client stopping');
    this.#socket = null;
    this.#manager.reset();
  }

  /** Throws `ZodError` if the config is invalid; the previous config stays in effect. */
  updateConfig(config: ThemeConfigInput): void {
    this.#manager.updateConfig(config);
  }

  #connect(): void {
    const { url, token, clientVersion, logger } = this.#options;
    const socket = new WebSocket(url);
    this.#socket = socket;

    socket.addEventListener('open', () => {
      socket.send(encodeMessage(createHello(token, { kind: 'foundry', version: clientVersion })));
    });

    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') return;
      const result = decodeServerMessage(event.data);
      if (!result.ok) {
        logger.log('warn', 'bridge_frame_rejected', { reason: result.reason, detail: result.detail });
        return;
      }
      const message = result.message;
      switch (message.type) {
        case 'welcome':
          this.#attempt = 0;
          logger.log('info', 'bridge_connected', { sessionId: message.sessionId, server: message.serverVersion });
          return;
        case 'voice.speaking':
          this.#manager.handleSpeaking(message.userId, message.speaking);
          return;
        case 'error':
          logger.log('error', 'bridge_error', { code: message.code, message: message.message });
          return;
      }
    });

    socket.addEventListener('close', (event) => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      // Speaking state is unknown while disconnected: stop everything rather than leave themes stuck on.
      this.#manager.reset();
      if (this.#stopped) return;
      if (FATAL_CLOSE_CODES.has(event.code)) {
        this.#stopped = true;
        logger.log('error', 'bridge_refused', { code: event.code, reason: event.reason });
        this.#options.onRefused?.();
        return;
      }
      const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** this.#attempt++);
      const delay = backoff / 2 + Math.random() * (backoff / 2);
      logger.log('warn', 'bridge_disconnected', { code: event.code, retryInMs: Math.round(delay) });
      this.#reconnectTimer = setTimeout(() => this.#connect(), delay);
    });
  }
}
