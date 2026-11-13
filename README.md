# 📦 Inventario de la tienda

Aplicación web para llevar las **ventas**, **compras**, **stock**, **clientes** y **caja** de la tienda, con la misma estructura del Excel `correccion_resumen_clientes_contar`.

- **Backend:** NestJS 10 + TypeORM
- **Base de datos:** PostgreSQL en **Supabase** (producción) o SQLite en WebAssembly (local / StackBlitz)
- **Frontend:** HTML + CSS + JavaScript sin dependencias, servido como estáticos
- **Docs de la API:** Swagger en `/docs`
- **Publicada en:** https://crm-eight-three.vercel.app

## Pantallas (columnas del Excel)

| Pantalla | Hoja del Excel | Columnas |
|---|---|---|
| **Ventas → Ventas de mostrador** | Transcripcion_Vent | Fecha · Objeto / Producto · Cantidad · Valor Unitario · Valor Total · Pago Efectivo · Pago Nequi |
| **Ventas → Ventas a clientes** | Registro de Ventas | Cliente · Fecha · Condiciones / Pago · Cantidad · Descripción del Artículo · Precio Unitario · Valor Total |
| **Compras** | Inventario | Proveedor · Fecha Factura · Cliente / Destino · Cantidad · Descripción del Artículo · Precio Unitario · Valor Total |
| **Clientes** | Resumen clientes | Cliente · Cantidad de compras · Unidades compradas · Total comprado |
| **Productos** | Inventario (Cantidad) | Producto · Cantidad · Comprado · Vendido · **Stock = Cantidad + Comprado − Vendido** |
| **Caja** | — (calculado) | Ventas suman (entra dinero), compras restan (sale dinero), saldo acumulado |
| **Resumen** | — (calculado) | Totales, productos más vendidos y mejores clientes |

- **Valor Total** siempre se calcula como Cantidad × Valor/Precio Unitario, como en el Excel.
- En ventas de mostrador, **Pago Efectivo + Pago Nequi** debe sumar el Valor Total. Si no se indica el pago, todo queda en efectivo.
- **Resumen clientes** se calcula igual que las fórmulas del Excel (`COUNTIF` / `SUMIF` sobre "Registro de Ventas") y en el mismo orden.
- **Stock**: la **Cantidad** de la hoja Inventario es el stock inicial de cada producto. **Comprado** y **Vendido** empiezan en 0 y cuentan solo las compras y ventas registradas en la app; las ventas que vienen del Excel no descuentan del stock (sí cuentan en Ventas, Clientes y Caja). Stock = Cantidad + Comprado − Vendido; puede quedar negativo.
- Los productos se agrupan por nombre, sin distinguir mayúsculas, tildes ni espacios extra ("Cerdito Alcancía" = "cerdito alcancia").
- Las fechas se guardan tal como vienen en el Excel.
- En toda tabla hay buscador, filtro por fechas, fila de totales, y botones para editar y eliminar.

## Datos iniciales (del Excel)

Cuando la base está vacía, la app carga automáticamente los datos del Excel (`src/seed/datos-excel.ts`):
305 ventas de mostrador, 129 ventas a clientes (21 clientes) y 178 compras.

Para volver a generar ese archivo desde una versión nueva del Excel (requiere Python y `openpyxl`):

```bash
pip install openpyxl
npm run importar-excel -- ruta/al/archivo.xlsx
```

El script valida que cada hoja tenga las columnas esperadas. Los datos nuevos se cargan solo en una base vacía.

## Base de datos: Supabase

La app se conecta a PostgreSQL con la variable `DATABASE_URL` (o `POSTGRES_URL`):

1. En Supabase: **Project → Connect → Connection string → Transaction pooler** (puerto 6543). Copia la URI y reemplaza `[YOUR-PASSWORD]` por la contraseña de la base.
2. En Vercel: **crm-eight → Settings → Environment Variables** → `DATABASE_URL` = esa URI (entornos Production y Preview).
3. Vuelve a desplegar. Las tablas `ventas_mostrador`, `ventas_clientes` y `compras` se crean solas, y la primera vez se cargan los datos del Excel.

**Seguridad:** al arrancar, la app activa **Row Level Security** en sus tablas. Así la API REST pública de Supabase (la clave *publishable/anon*) no puede leerlas ni modificarlas; solo el backend, que se conecta con la contraseña, tiene acceso. La clave publishable no se usa en esta app.

Sin `DATABASE_URL`, en Vercel la app funciona en **modo demo** (SQLite en `/tmp`, los datos se reinician) y lo indica con un aviso.

## Correr localmente

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev        # http://localhost:3000 (SQLite en data/inventario.sqlite)
```

Variables opcionales:

- `DATABASE_URL` / `POSTGRES_URL`: usar PostgreSQL (Supabase) en lugar de SQLite
- `DB_PATH`: ruta del archivo SQLite, o `:memory:`
- `SEED`: `false` para no cargar los datos del Excel
- `PORT`: puerto (por defecto `3000`)

`npm run db:reset` borra la base local (SQLite); al arrancar se vuelven a cargar los datos del Excel.

## Abrir en StackBlitz

```
https://stackblitz.com/github/sebCarabali/crm-eight
```

## Publicar en Vercel

El repositorio ya está conectado: cada `git push` a `main` despliega automáticamente. La configuración está en `vercel.json`: la interfaz se sirve como estáticos desde `public/`, y la API (`/api/*`, `/docs`) como función serverless (`api/index.js`).

## Pruebas

```bash
npm test           # unitarias
npm run test:e2e   # API completa (SQLite en memoria)
DATABASE_URL=postgres://… npm run test:e2e   # contra PostgreSQL
```

Las pruebas verifican que los datos cargados coinciden con el Excel: filas por hoja, la hoja "Resumen clientes" y los totales de efectivo/Nequi.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/api/ventas-mostrador` | Listar (`?desde=&hasta=&q=`) / crear |
| GET/PATCH/DELETE | `/api/ventas-mostrador/:id` | Ver / editar / eliminar |
| GET/POST | `/api/ventas-clientes` | Listar / crear |
| GET/PATCH/DELETE | `/api/ventas-clientes/:id` | Ver / editar / eliminar |
| GET/POST | `/api/compras` | Listar / crear |
| GET/PATCH/DELETE | `/api/compras/:id` | Ver / editar / eliminar |
| GET | `/api/productos?q=` | Stock por producto (Cantidad + Comprado − Vendido) |
| GET | `/api/clientes/resumen?desde=&hasta=&q=` | Resumen por cliente |
| GET | `/api/caja?desde=&hasta=` | Ingresos, egresos, saldo y movimientos |
| GET | `/api/resumen` | Datos de la pantalla de inicio |
| GET | `/api/opciones` | Valores para autocompletar |

## Datos técnicos en el log

Las pantallas muestran solo las columnas del Excel. Los ids y el detalle técnico quedan en la consola del navegador (grupos `[Inventario]`) y en el log del servidor.

## Estructura

```
src/
  main.ts / vercel.ts       arranque local / función serverless de Vercel
  app.module.ts             módulos y conexión a la base
  common/                   configuración de la base (Supabase/SQLite), estado de la instalación
  registros/                entidades por hoja (ventas de mostrador, ventas a clientes, compras), validaciones y CRUD
  reportes/                 productos (stock), resumen de clientes, caja y resumen
  seed/                     datos del Excel y su carga inicial
scripts/excel_a_datos.py    convierte el Excel en src/seed/datos-excel.ts
public/                     interfaz web
test/                       pruebas e2e
```
