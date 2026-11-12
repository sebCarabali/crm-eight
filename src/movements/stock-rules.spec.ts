import { BadRequestException } from '@nestjs/common';
import { MovementType } from './stock-movement.entity';
import { computeNewStock } from './stock-rules';

describe('computeNewStock', () => {
  it('suma en una entrada', () => {
    expect(computeNewStock(10, MovementType.IN, 5)).toBe(15);
  });

  it('resta en una salida', () => {
    expect(computeNewStock(10, MovementType.OUT, 4)).toBe(6);
  });

  it('permite dejar el stock en cero', () => {
    expect(computeNewStock(3, MovementType.OUT, 3)).toBe(0);
  });

  it('rechaza una salida mayor al stock', () => {
    expect(() => computeNewStock(2, MovementType.OUT, 3)).toThrow(BadRequestException);
  });

  it('el ajuste fija el stock contado', () => {
    expect(computeNewStock(10, MovementType.ADJUST, 7)).toBe(7);
    expect(computeNewStock(10, MovementType.ADJUST, 0)).toBe(0);
  });

  it('rechaza cantidades en cero para entradas y salidas', () => {
    expect(() => computeNewStock(5, MovementType.IN, 0)).toThrow(BadRequestException);
    expect(() => computeNewStock(5, MovementType.OUT, 0)).toThrow(BadRequestException);
  });

  it('rechaza cantidades negativas o decimales', () => {
    expect(() => computeNewStock(5, MovementType.IN, -1)).toThrow(BadRequestException);
    expect(() => computeNewStock(5, MovementType.IN, 1.5)).toThrow(BadRequestException);
  });
});
