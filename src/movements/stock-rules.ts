import { BadRequestException } from '@nestjs/common';
import { MovementType } from './stock-movement.entity';

/** Calcula el nuevo stock de un producto tras un movimiento, validando las reglas de negocio. */
export function computeNewStock(current: number, type: MovementType, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new BadRequestException('La cantidad debe ser un número entero positivo');
  }
  switch (type) {
    case MovementType.IN:
      if (quantity === 0) throw new BadRequestException('La cantidad comprada debe ser mayor a 0');
      return current + quantity;
    case MovementType.OUT:
    case MovementType.SALE:
      if (quantity === 0) {
        throw new BadRequestException(
          type === MovementType.SALE
            ? 'La cantidad vendida debe ser mayor a 0'
            : 'La cantidad de salida debe ser mayor a 0',
        );
      }
      if (quantity > current) {
        throw new BadRequestException(
          `Stock insuficiente: hay ${current} unidad(es) y se intenta retirar ${quantity}`,
        );
      }
      return current - quantity;
    case MovementType.ADJUST:
      return quantity;
    default:
      throw new BadRequestException(`Tipo de movimiento inválido: ${type}`);
  }
}
