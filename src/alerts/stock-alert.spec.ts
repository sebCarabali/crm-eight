import { addDaysKey, storeDateKey, storeHour, storeTime } from '../common/store-time';
import { AlertLevel, alertLevelFor } from './stock-alert.entity';

describe('alertLevelFor (margen 2)', () => {
  it('agotado cuando el stock es 0', () => {
    expect(alertLevelFor(0, 5, 2)).toBe(AlertLevel.OUT_OF_STOCK);
  });

  it('bajo el mínimo cuando el stock es igual o menor al mínimo', () => {
    expect(alertLevelFor(5, 5, 2)).toBe(AlertLevel.BELOW_MIN);
    expect(alertLevelFor(3, 5, 2)).toBe(AlertLevel.BELOW_MIN);
  });

  it('cerca del mínimo cuando el stock está a 2 o menos del mínimo', () => {
    expect(alertLevelFor(6, 5, 2)).toBe(AlertLevel.NEAR_MIN);
    expect(alertLevelFor(7, 5, 2)).toBe(AlertLevel.NEAR_MIN);
  });

  it('sin alerta cuando el stock supera mínimo + 2', () => {
    expect(alertLevelFor(8, 5, 2)).toBeNull();
  });

  it('un producto con mínimo 0 alerta hasta 2 unidades', () => {
    expect(alertLevelFor(2, 0, 2)).toBe(AlertLevel.NEAR_MIN);
    expect(alertLevelFor(3, 0, 2)).toBeNull();
  });
});

describe('hora de la tienda (Colombia, UTC-5)', () => {
  it('convierte fechas y horas locales', () => {
    // 12 nov 2026, 3:00 a. m. UTC = 11 nov, 10:00 p. m. en Colombia
    const d = new Date('2026-11-12T03:00:00Z');
    expect(storeDateKey(d)).toBe('2026-11-11');
    expect(storeHour(d)).toBe(22);
    expect(storeTime('2026-11-12', 7).toISOString()).toBe('2026-11-12T12:00:00.000Z');
    expect(addDaysKey('2026-11-01', -1)).toBe('2026-10-31');
  });
});
