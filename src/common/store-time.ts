/**
 * Utilidades de fecha en la hora local de la tienda.
 * Por defecto Colombia (UTC-5, sin horario de verano). Configurable con STORE_UTC_OFFSET.
 */
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export function storeOffsetMs(): number {
  return Number(process.env.STORE_UTC_OFFSET ?? -5) * HOUR_MS;
}

/** Fecha local de la tienda en formato YYYY-MM-DD. */
export function storeDateKey(date: Date = new Date()): string {
  return new Date(date.getTime() + storeOffsetMs()).toISOString().slice(0, 10);
}

/** Hora local de la tienda (0-23). */
export function storeHour(date: Date = new Date()): number {
  return new Date(date.getTime() + storeOffsetMs()).getUTCHours();
}

/** Instante (UTC) que corresponde a la fecha local `dateKey` a la hora `hour`. */
export function storeTime(dateKey: string, hour = 0): Date {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) - storeOffsetMs() + hour * HOUR_MS);
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDaysKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
