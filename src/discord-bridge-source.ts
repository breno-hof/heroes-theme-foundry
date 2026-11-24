/**
 * Optional voice source: speech reported by a self-hosted Discord bot over a
 * WebSocket, for groups that talk on Discord instead of Foundry A/V. Nothing
 * else in the module depends on this file.
 */
import {
  CloseCode,
  createHello,
  decodeServerMessage,
  encodeMessage,
  type Logger,
} from '@breno-hof/heroes-theme-core';
import type { VoiceSource } from './theme-engine.js';

export interface DiscordBridgeOptions {
  url: string;
  token: string;
  clientVersion: string;
  logger: Logger;
  /** A Discord user started or stopped speaking. */
  onSpeaking: (discordUserId: string, speaking: boolean) => void;
  /** The connection dropped; speaking state is unknown until it is back. */
  onDisconnect: () => void;
  /** Called once when the bot rejects the token or protocol version; the source stops retrying. */
  onRefused?: () => void;
}

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
/** Close codes that will fail again identically, so retrying is pointless. */
const FATAL_CLOSE_CODES: ReadonlySet<number> = new Set([CloseCode.Unauthorized, CloseCode.UnsupportedVersion]);

/** Keeps a WebSocket open to the bot, with handshake and reconnect backoff. */
export class DiscordBridgeSource implements VoiceSource {
  readonly #options: DiscordBridgeOptions;
  #socket: WebSocket | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #attempt = 0;
  #stopped = true;

  constructor(options: DiscordBridgeOptions) {
    this.#options = options;
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
          this.#options.onSpeaking(message.userId, message.speaking);
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
      this.#options.onDisconnect();
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
