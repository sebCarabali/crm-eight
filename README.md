# 📦 Inventario — NestJS

Sistema de manejo de inventario con interfaz web y API REST.

- **Backend:** NestJS 10 + TypeORM
- **Base de datos:** SQLite vía [sql.js](https://sql.js.org) (WebAssembly, sin módulos nativos → **corre en StackBlitz**)
- **Frontend:** HTML + CSS + JavaScript sin dependencias, servido por el mismo NestJS
- **Docs de la API:** Swagger en `/docs`

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Categorías** | Crear, editar y eliminar (no deja borrar categorías con productos). |
| **Productos** | CRUD con SKU único, precio, stock mínimo y categoría. Búsqueda por nombre/SKU y filtros por categoría y stock bajo. |
| **Ventas** | Registrar ventas (descuentan stock y guardan el precio cobrado). Pantalla con filtros por fecha (hoy, 7 días, 30 días, este mes, todo o rango) y producto, total vendido, número de ventas, unidades, ticket promedio, gráfico por día/mes, productos más vendidos y detalle. |
| **Movimientos** | Entradas (+), salidas (−), ajustes por conteo físico y ventas. Cada movimiento guarda stock anterior y nuevo. No permite sacar más de lo que hay. |
| **Resumen** | Ventas de hoy, total de productos, unidades, valor del inventario y lista de productos con stock bajo. |

> El stock de un producto **solo cambia con movimientos**, así siempre queda historial de cada unidad que entra o sale.

## Abrir en StackBlitz

Abre esta URL (se instala y arranca sola):

```
https://stackblitz.com/github/sebCarabali/crm-eight
```

La app queda en la vista previa; la API en `/api` y Swagger en `/docs`.

## Correr localmente

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev        # modo desarrollo con recarga automática → http://localhost:3000
```

Producción:

```bash
npm run build
npm run start:prod
```

Los datos se guardan en `data/inventario.sqlite`. Variables opcionales:

- `PORT` — puerto (por defecto `3000`)
- `DB_PATH` — ruta del archivo SQLite, o `:memory:` para no guardar nada

## Pruebas

```bash
npm test           # pruebas unitarias de las reglas de stock
npm run test:e2e   # pruebas de la API completa (base en memoria)
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/categories` | Lista categorías (con conteo de productos) |
| POST | `/api/categories` | Crea categoría |
| PATCH | `/api/categories/:id` | Edita categoría |
| DELETE | `/api/categories/:id` | Elimina categoría |
| GET | `/api/products?search=&categoryId=&lowStock=true` | Lista/busca productos |
| GET | `/api/products/summary` | Resumen del inventario |
| GET | `/api/products/:id` | Detalle de producto |
| POST | `/api/products` | Crea producto (acepta `initialStock`) |
| PATCH | `/api/products/:id` | Edita producto (no el stock) |
| DELETE | `/api/products/:id` | Elimina producto y su historial |
| GET | `/api/movements?productId=&type=&limit=` | Historial de movimientos |
| POST | `/api/movements` | Registra movimiento `{ productId, type: IN\|OUT\|ADJUST\|SALE, quantity, unitPrice?, reason }` |
| GET | `/api/sales?from=&to=&productId=` | Reporte de ventas: totales, productos más vendidos y detalle (`from`/`to` en ISO 8601) |

## Estructura

```
src/
  main.ts                 arranque, validación global, Swagger, archivos estáticos
  app.module.ts           conexión a la base de datos
  categories/             entidad, DTOs, servicio y controlador de categorías
  products/               entidad, DTOs, servicio y controlador de productos
  movements/              movimientos de stock y reglas de negocio (stock-rules.ts)
public/                   interfaz web (index.html, app.js, styles.css)
test/                     pruebas e2e
```
