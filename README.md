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
| **Ventas** | Registrar ventas (descuentan stock y guardan el precio cobrado). Filtros por fecha (hoy, 7 días, 30 días, este mes, todo o rango) y producto, total vendido, número de ventas, unidades, ticket promedio, gráfico por día/mes, productos más vendidos y detalle. |
| **Alertas diarias** | Todos los días a las 7:00 a. m. (hora de Colombia) se generan alertas de los productos con **stock ≤ mínimo + 2**: *Agotado*, *Bajo el mínimo* o *Cerca del mínimo*. Contador en el menú, aviso en el Resumen, historial por día, cantidad sugerida a pedir, y registrar entrada o marcar como atendida. |
| **Caja** | Ingresos por ventas, egresos por compras y **saldo** del periodo (hoy, 7 días, 30 días, mes, todo o rango). Gráfico de ingresos vs. egresos por día/mes y detalle con saldo acumulado. |
| **Movimientos** | Ventas, compras y ajustes. Cada movimiento guarda stock anterior y nuevo. No permite vender más de lo que hay. |
| **Resumen** | Ventas de hoy, saldo del mes, valor del inventario y lista de productos con stock bajo. |

> El stock de un producto **solo cambia con movimientos**, así siempre queda historial de cada unidad que entra o sale.

## Ventas, compras y saldo

| Movimiento | Stock | Dinero |
|---|---|---|
| **Venta** (salida) | baja | **entra** (+ precio de venta) |
| **Compra** (entrada) | sube | **sale** (− costo de compra) |
| **Ajuste** / inventario inicial | se fija al conteo | no afecta |

- Cada producto tiene **costo de compra** y **precio de venta**; se usan como valores por defecto al registrar compras y ventas (se pueden cambiar en cada una).
- **Saldo** = ingresos por ventas − egresos por compras en el periodo.
- El **inventario inicial** de un producto nuevo es mercancía que ya se tenía: no cuenta como compra.
- Las "salidas" registradas en versiones anteriores se convierten automáticamente en ventas al arrancar.

## Datos de prueba: tienda de barrio colombiana

La primera vez que arranca (con la base vacía) se cargan automáticamente:

- **14 categorías**: Bebidas, Lácteos y huevos, Panadería, Granos y abarrotes, Café y chocolate, Enlatados y conservas, Carnes frías, Mecato y paquetes, Dulces y galletas, Condimentos y salsas, Frutas y verduras, Aseo del hogar, Aseo personal, Cervezas y licores.
- **73 productos** típicos (Coca-Cola, Pony Malta, leche Alquería, pandebono, arroz Diana, panela, café Sello Rojo, Chocoramo, Bon Bon Bum, Jabón Rey, cerveza Águila…) con precio de venta y costo de compra de referencia en pesos (margen de 22 % a 30 %).
- **Alertas de la última semana**, reconstruidas con el stock que había cada día a las 7:00 a. m.
- **Un mes de historial**: unas 1.000 ventas entre 7 a. m. y 9 p. m. (más movimiento en fines de semana y quincena), compras a proveedores y algunos ajustes. Varios productos quedan en stock bajo.

Los datos se generan con una semilla fija, así que siempre salen iguales. Se definen en `src/seed/seed-data.ts`.

- Para **volver a empezar** con los datos de prueba: `npm run db:reset` y arrancar de nuevo.
- Para **no cargar** datos de prueba: `SEED=false npm run dev`.

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
- `SEED` — `false` para no cargar los datos de prueba
- `ALERT_MARGIN` — unidades sobre el mínimo que disparan la alerta (por defecto `2`)
- `ALERT_HOUR` — hora local en que se generan las alertas diarias (por defecto `7`)
- `ALERTS_AUTO` — `false` para desactivar la generación automática
- `STORE_UTC_OFFSET` — zona horaria de la tienda en horas (por defecto `-5`, Colombia)

### Cómo funcionan las alertas

El servidor revisa cada minuto: si ya pasó la hora configurada y las alertas del día no se han generado, las genera con el stock de ese momento. Si el servidor arranca después de esa hora, las genera al arrancar. El botón **Actualizar ahora** las recalcula con el stock actual: conserva las que ya marcaste como atendidas y quita las que ya no aplican. Al registrar una entrada desde una alerta, la alerta queda atendida.

El "sugerido pedir" es lo que falta para llegar al doble del stock mínimo.

## Datos técnicos en el log

Las pantallas muestran solo lo que necesita quien atiende la tienda. El detalle técnico queda en el log:

- **Navegador** (Herramientas de desarrollador → Consola, grupos `[Inventario]`): SKU, stock antes y después de cada movimiento, valores unitarios, detalle de caja, stock que tenía cada producto al generar la alerta y hora de generación.
- **Servidor**: generación de alertas con el detalle por producto (stock al generar, mínimo y nivel) y la dirección de la documentación de la API (`/docs`).

El SKU solo se muestra en la pantalla de Productos, donde se administra. Toda esta información sigue disponible en la API.

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
| POST | `/api/movements` | Registra movimiento `{ productId, type: SALE\|IN\|ADJUST, quantity, unitPrice?, reason }` (SALE = venta, IN = compra) |
| GET | `/api/cash?from=&to=&productId=` | Caja: ingresos, egresos, saldo y movimientos con saldo acumulado |
| GET | `/api/alerts?date=YYYY-MM-DD` | Alertas de un día (por defecto hoy) con conteos por nivel |
| GET | `/api/alerts/days?limit=14` | Últimos días con alertas |
| POST | `/api/alerts/generate` | Genera/actualiza ya mismo las alertas de hoy |
| PATCH | `/api/alerts/:id` | Marca una alerta como atendida `{ resolved: true }` |
| GET | `/api/sales?from=&to=&productId=` | Reporte de ventas: totales, productos más vendidos y detalle (`from`/`to` en ISO 8601) |

## Estructura

```
src/
  main.ts                 arranque, validación global, Swagger, archivos estáticos
  app.module.ts           conexión a la base de datos
  categories/             entidad, DTOs, servicio y controlador de categorías
  products/               entidad, DTOs, servicio y controlador de productos
  movements/              movimientos de stock, reporte de ventas y reglas de negocio (stock-rules.ts)
  alerts/                 alertas diarias de stock (generación programada, API)
  common/                 utilidades de fecha/hora de la tienda
  seed/                   datos de prueba de la tienda (seed-data.ts) y su carga automática
public/                   interfaz web (index.html, app.js, styles.css)
test/                     pruebas e2e
```
