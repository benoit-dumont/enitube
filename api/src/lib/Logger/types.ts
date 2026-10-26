/**
 * @file Types partagés du Logger.
 * @author DUMONT Benoit <benoit.dum74@gmail.com>
 *
 * @module Lib/Logger/Types
 */

export const LOG_LEVELS = [
  'debug',
  'info',
  'warn',
  'error',
  'success',
  'fail',
  'launch',
  'wait',
  'end',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Une ligne de log, telle que reçue par les transports (console, dashboard CLI, app...). */
export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  message: string;
  /** Origine du message (ex: "FT", "WTTJ"), ou `null` pour un message global. */
  source: string | null;
}

/** Destination des logs. Le Logger en alimente autant qu'on lui en branche. */
export interface LogTransport {
  write(entry: LogEntry): void;
  /** Oublie l'état interne (ex: dernier message) quand un autre écrivain a touché au terminal. */
  reset?(): void;
}

export type LogMethod = (value: unknown) => void;

/** Logger lié à une source : chaque message porte son origine (ex: "FT"). */
export type ScopedLogger = Readonly<Record<LogLevel, LogMethod>> & {
  readonly source: string;
};
