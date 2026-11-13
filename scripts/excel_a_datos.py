#!/usr/bin/env python3
"""
Convierte el Excel de la tienda en los datos iniciales de la app (src/seed/datos-excel.ts).

Uso:
    python3 scripts/excel_a_datos.py ruta/al/archivo.xlsx

Hojas que lee (por posición, con estas columnas):
  1. Ventas de mostrador: Fecha | Objeto / Producto | Cantidad | Valor Unitario | Valor Total | Pago Efectivo | Pago Nequi
  2. Inventario (compras): Proveedor | Fecha Factura | Cliente / Destino | Cantidad | Descripción del Artículo | Precio Unitario | Valor Total
  3. Registro de Ventas:   Cliente | Fecha | Condiciones / Pago | Cantidad | Descripción del Artículo | Precio Unitario | Valor Total
La hoja 4 (Resumen clientes) no se importa: la app la calcula igual que el Excel (COUNTIF/SUMIF).

Requiere: pip install openpyxl
"""
import datetime
import json
import sys
from pathlib import Path

import openpyxl

HEADERS = [
    ['Fecha', 'Objeto / Producto', 'Cantidad', 'Valor Unitario', 'Valor Total', 'Pago Efectivo', 'Pago Nequi'],
    ['Proveedor', 'Fecha Factura', 'Cliente / Destino', 'Cantidad', 'Descripción del Artículo', 'Precio Unitario', 'Valor Total'],
    ['Cliente', 'Fecha', 'Condiciones / Pago', 'Cantidad', 'Descripción del Artículo', 'Precio Unitario', 'Valor Total'],
]


def fecha(value) -> str:
    """Fecha del Excel (texto DD/MM/AAAA o fecha) → AAAA-MM-DD."""
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    day, month, year = str(value).strip().split('/')
    return datetime.date(int(year), int(month), int(day)).isoformat()


def numero(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return float(str(value).replace('$', '').replace(',', '').strip() or 0)


def texto(value) -> str:
    return ' '.join(str(value).split())


def filas(ws, headers):
    found = [texto(c.value) for c in ws[1][: len(headers)]]
    if found != headers:
        raise SystemExit(f'La hoja "{ws.title}" no tiene las columnas esperadas.\n  Esperadas: {headers}\n  Encontradas: {found}')
    for row in ws.iter_rows(min_row=2, values_only=True):
        if any(c not in (None, '') for c in row[: len(headers)]):
            yield row


def main(path: str) -> None:
    wb = openpyxl.load_workbook(path, data_only=False)
    mostrador_ws, compras_ws, clientes_ws = wb.worksheets[0], wb.worksheets[1], wb.worksheets[2]

    ventas_mostrador = []
    for r in filas(mostrador_ws, HEADERS[0]):
        cantidad, unitario = numero(r[2]), numero(r[3])
        ventas_mostrador.append({
            'fecha': fecha(r[0]),
            'producto': texto(r[1]),
            'cantidad': cantidad,
            'valorUnitario': unitario,
            'valorTotal': cantidad * unitario,  # en el Excel: =Cantidad*Valor Unitario
            'pagoEfectivo': numero(r[5] or 0),
            'pagoNequi': numero(r[6] or 0),
        })

    compras = []
    for r in filas(compras_ws, HEADERS[1]):
        cantidad, unitario = numero(r[3]), numero(r[5])
        compras.append({
            'proveedor': texto(r[0]),
            'fechaFactura': fecha(r[1]),
            'clienteDestino': texto(r[2]),
            'cantidad': cantidad,
            'descripcion': texto(r[4]),
            'precioUnitario': unitario,
            'valorTotal': cantidad * unitario,
        })

    ventas_clientes = []
    for r in filas(clientes_ws, HEADERS[2]):
        cantidad, unitario = numero(r[3]), numero(r[5])
        ventas_clientes.append({
            'cliente': texto(r[0]),
            'fecha': fecha(r[1]),
            'condicionesPago': texto(r[2]),
            'cantidad': cantidad,
            'descripcion': texto(r[4]),
            'precioUnitario': unitario,
            'valorTotal': cantidad * unitario,
        })

    out = Path(__file__).resolve().parent.parent / 'src' / 'seed' / 'datos-excel.ts'
    body = {
        'ventasMostrador': ventas_mostrador,
        'compras': compras,
        'ventasClientes': ventas_clientes,
    }
    out.write_text(
        '// Archivo generado por scripts/excel_a_datos.py a partir del Excel de la tienda. No editar a mano.\n'
        f'// Origen: {Path(path).name}\n'
        "import type { DatosExcel } from './datos-excel.types';\n\n"
        f'export const DATOS_EXCEL: DatosExcel = {json.dumps(body, ensure_ascii=False, indent=1)};\n',
        encoding='utf-8',
    )
    print(f'{out}: {len(ventas_mostrador)} ventas de mostrador, {len(compras)} compras, {len(ventas_clientes)} ventas a clientes')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
