import { inspect } from 'node:util';

export interface TimeUnits {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

/**
 * @description Transforme n'importe quelle valeur en texte lisible.
 * Les objets sont inspectés (et non convertis en "[object Object]"), les erreurs gardent leur
 * type, et `null`/`undefined` ne font plus planter.
 */
export function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    return inspect(value, { depth: 3, breakLength: Infinity });
  }
  return String(value);
}

/**
 * @description Découpe une durée en heures, minutes, secondes et millisecondes.
 */
export function getTimeUnits(duration: number): TimeUnits {
  const SECOND = 1_000;
  const MINUTE = SECOND * 60;
  const HOUR = MINUTE * 60;

  const hours = Math.floor(duration / HOUR);
  const afterHours = duration - hours * HOUR;
  const minutes = Math.floor(afterHours / MINUTE);
  const afterMinutes = afterHours - minutes * MINUTE;
  const seconds = Math.floor(afterMinutes / SECOND);
  const milliseconds = afterMinutes - seconds * SECOND;

  return { hours, minutes, seconds, milliseconds };
}

/**
 * @description Formate une durée en texte court, ex: `1h 2m 3s 40ms`.
 */
export function formatDuration(duration: number): string {
  const { hours, minutes, seconds, milliseconds } = getTimeUnits(Math.max(0, duration));
  const parts = [
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    seconds && `${seconds}s`,
    milliseconds && `${milliseconds}ms`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '0ms';
}
