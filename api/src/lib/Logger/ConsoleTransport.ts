/**
 * @file Transport console : affiche les logs dans le terminal.
 * @author DUMONT Benoit <benoit.dum74@gmail.com>
 *
 * @module Lib/Logger/ConsoleTransport
 */

import readline from 'node:readline';
import { stripVTControlCharacters } from 'node:util';
import chalk from 'chalk';
import type { LogEntry, LogLevel, LogTransport } from './types.js';

export const PIPE = chalk.bold('|');

const PREFIXES: Record<LogLevel, string> = {
  debug: '  🔵  ',
  info: '  🟡  ',
  warn: '  🟠  ',
  error: '  🔴  ',
  success: '  ✅  ',
  fail: '  ❌  ',
  launch: '  🚀  ',
  wait: '  ⏱️  ',
  end: '  🎉  ',
};

/** Avertissements et erreurs vont sur stderr, le reste sur stdout. */
const STDERR_LEVELS = new Set<LogLevel>(['warn', 'error', 'fail']);

/** Marge de sécurité : les emojis occupent 2 colonnes et le compteur `[xN]` allonge la ligne. */
const WIDTH_MARGIN = 12;

export interface ConsoleStreams {
  out: NodeJS.WriteStream;
  err: NodeJS.WriteStream;
}

/**
 * Écrit chaque log sur sa propre ligne. Dans un vrai terminal, un message identique répété à la
 * suite réécrit la même ligne avec un compteur (`[x3]`) ; hors terminal (fichier, pm2, CI), chaque
 * message reste une ligne à part.
 */
export class ConsoleTransport implements LogTransport {
  #last: { key: string; count: number } | null = null;

  constructor(
    private readonly streams: ConsoleStreams = { out: process.stdout, err: process.stderr },
  ) {}

  reset(): void {
    this.#last = null;
  }

  write(entry: LogEntry): void {
    const stream = STDERR_LEVELS.has(entry.level) ? this.streams.err : this.streams.out;
    const line = this.#format(entry);
    const key = `${entry.level}|${entry.source ?? ''}|${entry.message}`;

    if (this.#last?.key === key && this.#canRewrite(stream, entry.message, line)) {
      this.#last.count += 1;
      readline.moveCursor(stream, 0, -1);
      readline.cursorTo(stream, 0);
      readline.clearLine(stream, 0);
      stream.write(`${line} ${chalk.dim(`[x${this.#last.count}]`)}\n`);
      return;
    }

    this.#last = { key, count: 1 };
    stream.write(`${line}\n`);
  }

  #format({ level, source, message }: LogEntry): string {
    const scope = source ? `${chalk.cyan(`[${source}]`)} ` : '';
    return `${PREFIXES[level]} ${PIPE} ${scope}${message}`;
  }

  /** Réécrire la ligne précédente n'est sûr que dans un terminal, et si elle ne s'étend pas sur plusieurs lignes. */
  #canRewrite(stream: NodeJS.WriteStream, message: string, line: string): boolean {
    if (!stream.isTTY || message.includes('\n')) return false;
    return stripVTControlCharacters(line).length + WIDTH_MARGIN < (stream.columns ?? 80);
  }
}
