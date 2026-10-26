import ora, { type Ora } from 'ora';
import { ConsoleTransport, PIPE } from './ConsoleTransport.js';
import { formatDuration, formatValue, getTimeUnits, type TimeUnits } from './format.js';
import {
  LOG_LEVELS,
  type LogEntry,
  type LogLevel,
  type LogMethod,
  type LogTransport,
  type ScopedLogger,
} from './types.js';

export type { LogEntry, LogLevel, LogTransport, ScopedLogger } from './types.js';
export { ConsoleTransport } from './ConsoleTransport.js';

type KillStatus = 'succeed' | 'fail' | 'warn' | 'info' | 'stopAndPersist';

const ALLOWED_KILL_STATUS: readonly KillStatus[] = [
  'succeed',
  'fail',
  'warn',
  'info',
  'stopAndPersist',
];

interface LoaderSettings {
  message: string;
  timerName?: string | null;
}

interface KillLoaderSettings {
  spinner: Ora;
  killStatus: KillStatus;
  killMessage: string;
  timerName?: string | null;
}

const consoleTransport = new ConsoleTransport();

/**
 * @class
 * @hideconstructor
 */
export class Logger {
  static #transports = new Set<LogTransport>([consoleTransport]);

  static #nextId = 1;

  static #timers = new Map<string, number>();

  static #emit(level: LogLevel, value: unknown, source: string | null): void {
    // Les messages `debug` ne sont produits que si APP_DEBUG=true.
    if (level === 'debug' && process.env.APP_DEBUG !== 'true') return;

    const entry: LogEntry = {
      id: Logger.#nextId,
      timestamp: Date.now(),
      level,
      message: formatValue(value),
      source,
    };
    Logger.#nextId += 1;

    for (const transport of Logger.#transports) {
      try {
        transport.write(entry);
      } catch {
        // Un transport défaillant ne doit jamais casser l'application.
      }
    }
  }

  /** @description Message de debug (uniquement si APP_DEBUG=true). */
  static debug(value: unknown): void {
    Logger.#emit('debug', value, null);
  }

  static info(value: unknown): void {
    Logger.#emit('info', value, null);
  }

  static warn(value: unknown): void {
    Logger.#emit('warn', value, null);
  }

  static error(value: unknown): void {
    Logger.#emit('error', value, null);
  }

  static success(value: unknown): void {
    Logger.#emit('success', value, null);
  }

  static fail(value: unknown): void {
    Logger.#emit('fail', value, null);
  }

  static launch(value: unknown): void {
    Logger.#emit('launch', value, null);
  }

  static wait(value: unknown): void {
    Logger.#emit('wait', value, null);
  }

  static end(value: unknown): void {
    Logger.#emit('end', value, null);
  }

  /**
   * @description Crée un logger lié à une source : `Logger.scope('FT').info('...')`.
   * Le message porte alors son origine, ce qui permet de l'afficher `[FT]` et de filtrer par source.
   */
  static scope(source: string): ScopedLogger {
    const methods = Object.fromEntries(
      LOG_LEVELS.map((level) => [level, (value: unknown) => Logger.#emit(level, value, source)]),
    ) as Record<LogLevel, LogMethod>;
    return Object.freeze({ ...methods, source });
  }

  /**
   * @description Branche un transport supplémentaire.
   * @returns Une fonction qui le débranche.
   */
  static addTransport(transport: LogTransport): () => void {
    Logger.#transports.add(transport);
    return () => Logger.removeTransport(transport);
  }

  static removeTransport(transport: LogTransport): void {
    Logger.#transports.delete(transport);
  }

  /** @description Le transport console (pour y écrire directement, sans passer par les autres transports). */
  static get console(): ConsoleTransport {
    return consoleTransport;
  }

  /** @description Active/désactive l'affichage console (ex: quand un dashboard occupe le terminal). */
  static setConsoleEnabled(enabled: boolean): void {
    if (enabled) {
      consoleTransport.reset();
      Logger.#transports.add(consoleTransport);
    } else {
      Logger.#transports.delete(consoleTransport);
    }
  }

  /**
   * @description Démarre un spinner (et éventuellement un timer nommé).
   * Réservé à un usage séquentiel : plusieurs spinners simultanés se marchent dessus.
   */
  static loader({ message, timerName = null }: LoaderSettings): Ora {
    for (const transport of Logger.#transports) transport.reset?.();
    const spinner = ora(`${PIPE} ${message}`).start();
    if (timerName) {
      Logger.#timers.set(timerName, Date.now());
    }
    return spinner;
  }

  /**
   * @description Termine le spinner avec le statut donné, en ajoutant la durée si un timer lui était associé.
   * @throws {Error} Le `killStatus` n'est pas autorisé.
   */
  static killLoader({
    spinner,
    killStatus,
    killMessage,
    timerName = null,
  }: KillLoaderSettings): void {
    if (!ALLOWED_KILL_STATUS.includes(killStatus)) {
      throw new Error('❌ Unauthorized method');
    }

    const startedAt = timerName ? Logger.#timers.get(timerName) : undefined;
    const duration = startedAt === undefined ? '' : ` (${formatDuration(Date.now() - startedAt)})`;
    if (timerName) Logger.#timers.delete(timerName);

    spinner[killStatus](`${killMessage}${duration}`);
  }

  /** @description Découpe une durée en heures, minutes, secondes et millisecondes. */
  static getTimeUnits(duration: number): TimeUnits {
    return getTimeUnits(duration);
  }
}

export default Logger;
