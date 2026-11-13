// Interfaz del inventario: JavaScript sin dependencias que consume la API REST (/api).
// Las pantallas muestran solo las columnas del Excel de la tienda.

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const PAGINA = 50;
const state = { opciones: null, listas: {} };

const $ = (sel) => document.querySelector(sel);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** AAAA-MM-DD → DD/MM/AAAA, como en el Excel. */
function fechaTexto(f) {
  if (!f) return '';
  const [y, m, d] = String(f).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Fecha de hoy (hora local) en AAAA-MM-DD. */
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join('. ') : data?.message;
    throw new Error(msg || `Error ${res.status}`);
  }
  return data;
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2500);
}

/** Datos técnicos (ids, etc.): solo en la consola del navegador. */
function logData(title, rows) {
  if (!rows || !rows.length) return;
  console.groupCollapsed(`[Inventario] ${title} (${rows.length})`);
  console.table(rows);
  console.groupEnd();
}

function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" class="empty">${text}</td></tr>`;
}

function params(prefix) {
  const p = new URLSearchParams();
  for (const k of ['q', 'desde', 'hasta']) {
    const el = $(`#${prefix}-${k}`);
    if (el && el.value.trim()) p.set(k, el.value.trim());
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

function debounce(fn, ms = 250) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

/** Conecta buscador y fechas de una pantalla con su función de carga. */
function bindFiltros(prefix, cargar) {
  const q = $(`#${prefix}-q`);
  if (q) q.addEventListener('input', debounce(cargar));
  for (const k of ['desde', 'hasta']) $(`#${prefix}-${k}`)?.addEventListener('change', cargar);
}

/** Tabla paginada: muestra de a PAGINA filas con "Mostrar más". */
function pintarLista(prefix, filas, render, cols, vacio) {
  state.listas[prefix] = { filas, render, cols, vacio, mostradas: PAGINA };
  repintar(prefix);
}
function repintar(prefix) {
  const l = state.listas[prefix];
  const visibles = l.filas.slice(0, l.mostradas);
  $(`#${prefix}-body`).innerHTML = l.filas.length ? visibles.map(l.render).join('') : emptyRow(l.cols, l.vacio);
  const mas = $(`#${prefix}-mas`);
  if (mas) {
    mas.hidden = l.filas.length <= l.mostradas;
    mas.textContent = `Mostrar más (${l.filas.length - visibles.length} restantes)`;
  }
}
for (const prefix of ['vm', 'vc', 'co', 'pr', 'ca']) {
  $(`#${prefix}-mas`)?.addEventListener('click', () => {
    state.listas[prefix].mostradas += PAGINA;
    repintar(prefix);
  });
}

const acciones = (tipo, id) => `<td class="actions-cell">
  <button class="link" data-editar="${tipo}" data-id="${id}">Editar</button>
  <button class="link danger" data-borrar="${tipo}" data-id="${id}">Eliminar</button>
</td>`;

// ---------- Pestañas ----------
const CARGAS = {
  resumen: () => cargarResumen(),
  ventas: () => (state.sub === 'clientes' ? cargarVentasClientes() : cargarVentasMostrador()),
  compras: () => cargarCompras(),
  productos: () => cargarProductos(),
  clientes: () => cargarClientes(),
  caja: () => cargarCaja(),
};

document.querySelectorAll('.tabs button').forEach((btn) => btn.addEventListener('click', () => mostrarTab(btn.dataset.tab)));

function mostrarTab(nombre) {
  state.tab = nombre;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === nombre));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${nombre}`));
  CARGAS[nombre]().catch((err) => toast(err.message));
}

document.querySelectorAll('#ventas-subtabs button').forEach((btn) =>
  btn.addEventListener('click', () => {
    state.sub = btn.dataset.sub;
    document.querySelectorAll('#ventas-subtabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('#tab-ventas .sub').forEach((s) => s.classList.toggle('active', s.id === `sub-${btn.dataset.sub}`));
    CARGAS.ventas().catch((err) => toast(err.message));
  }),
);

// ---------- Opciones para autocompletar ----------
async function cargarOpciones() {
  const o = await api('/opciones');
  state.opciones = o;
  const opts = (vals) => vals.map((v) => `<option value="${esc(v)}"></option>`).join('');
  $('#dl-productos').innerHTML = opts(o.productos.map((p) => p.producto));
  $('#dl-clientes').innerHTML = opts(o.clientes);
  $('#dl-condiciones').innerHTML = opts(o.condicionesPago);
  $('#dl-proveedores').innerHTML = opts(o.proveedores);
  $('#dl-destinos').innerHTML = opts(o.destinos);
}

function buscarProducto(nombre) {
  const clave = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const k = clave(nombre || '');
  return state.opciones?.productos.find((p) => clave(p.producto) === k);
}

// ---------- Resumen ----------
async function cargarResumen() {
  const r = await api('/resumen');
  const t = r.totales;
  $('#r-ingresos').textContent = money.format(t.ingresos);
  $('#r-ingresos-det').textContent = `Mostrador ${money.format(t.ventasMostrador)} · Clientes ${money.format(t.ventasClientes)}`;
  $('#r-egresos').textContent = money.format(t.egresos);
  $('#r-saldo').textContent = money.format(t.saldo);
  $('#r-saldo-card').classList.toggle('negative', t.saldo < 0);
  $('#r-clientes').textContent = r.clientes;
  $('#r-negativos').textContent = r.productosStockNegativo;
  $('#r-productos').textContent = `de ${r.productos} productos`;
  $('#r-mas-vendidos').innerHTML = r.masVendidos.length
    ? r.masVendidos.map((p) => `<tr><td>${esc(p.producto)}</td><td class="num">${num.format(p.vendido)}</td></tr>`).join('')
    : emptyRow(2, 'Sin ventas');
  $('#r-mejores-clientes').innerHTML = r.mejoresClientes.length
    ? r.mejoresClientes.map((c) => `<tr><td>${esc(c.cliente)}</td><td class="num">${money.format(c.totalComprado)}</td></tr>`).join('')
    : emptyRow(2, 'Sin ventas a clientes');
}

// ---------- Ventas de mostrador ----------
async function cargarVentasMostrador() {
  const filas = await api(`/ventas-mostrador${params('vm')}`);
  logData('Ventas de mostrador', filas);
  pintarLista(
    'vm',
    filas,
    (v) => `<tr>
      <td>${fechaTexto(v.fecha)}</td><td>${esc(v.producto)}</td>
      <td class="num">${num.format(v.cantidad)}</td><td class="num">${money.format(v.valorUnitario)}</td>
      <td class="num"><strong>${money.format(v.valorTotal)}</strong></td>
      <td class="num">${money.format(v.pagoEfectivo)}</td><td class="num">${money.format(v.pagoNequi)}</td>
      ${acciones('mostrador', v.id)}
    </tr>`,
    8,
    'No hay ventas de mostrador con estos filtros.',
  );
  const suma = (k) => filas.reduce((s, v) => s + v[k], 0);
  $('#vm-foot').innerHTML = filas.length
    ? `<tr><td colspan="2">Total (${filas.length} filas)</td><td class="num">${num.format(suma('cantidad'))}</td><td></td>
       <td class="num">${money.format(suma('valorTotal'))}</td><td class="num">${money.format(suma('pagoEfectivo'))}</td>
       <td class="num">${money.format(suma('pagoNequi'))}</td><td></td></tr>`
    : '';
}
bindFiltros('vm', () => cargarVentasMostrador().catch((e) => toast(e.message)));

// ---------- Ventas a clientes ----------
async function cargarVentasClientes() {
  const filas = await api(`/ventas-clientes${params('vc')}`);
  logData('Ventas a clientes', filas);
  pintarLista(
    'vc',
    filas,
    (v) => `<tr>
      <td>${esc(v.cliente)}</td><td>${fechaTexto(v.fecha)}</td><td>${esc(v.condicionesPago)}</td>
      <td class="num">${num.format(v.cantidad)}</td><td>${esc(v.descripcion)}</td>
      <td class="num">${money.format(v.precioUnitario)}</td><td class="num"><strong>${money.format(v.valorTotal)}</strong></td>
      ${acciones('cliente', v.id)}
    </tr>`,
    8,
    'No hay ventas a clientes con estos filtros.',
  );
  const suma = (k) => filas.reduce((s, v) => s + v[k], 0);
  $('#vc-foot').innerHTML = filas.length
    ? `<tr><td colspan="3">Total (${filas.length} filas)</td><td class="num">${num.format(suma('cantidad'))}</td><td colspan="2"></td>
       <td class="num">${money.format(suma('valorTotal'))}</td><td></td></tr>`
    : '';
}
bindFiltros('vc', () => cargarVentasClientes().catch((e) => toast(e.message)));

// ---------- Compras (hoja Inventario) ----------
async function cargarCompras() {
  const filas = await api(`/compras${params('co')}`);
  logData('Compras', filas);
  pintarLista(
    'co',
    filas,
    (c) => `<tr>
      <td>${esc(c.proveedor)}</td><td>${fechaTexto(c.fechaFactura)}</td><td>${esc(c.clienteDestino)}</td>
      <td class="num">${num.format(c.cantidad)}</td><td>${esc(c.descripcion)}</td>
      <td class="num">${money.format(c.precioUnitario)}</td><td class="num"><strong>${money.format(c.valorTotal)}</strong></td>
      ${acciones('compra', c.id)}
    </tr>`,
    8,
    'No hay compras con estos filtros.',
  );
  const suma = (k) => filas.reduce((s, v) => s + v[k], 0);
  $('#co-foot').innerHTML = filas.length
    ? `<tr><td colspan="3">Total (${filas.length} filas)</td><td class="num">${num.format(suma('cantidad'))}</td><td colspan="2"></td>
       <td class="num">${money.format(suma('valorTotal'))}</td><td></td></tr>`
    : '';
}
bindFiltros('co', () => cargarCompras().catch((e) => toast(e.message)));

// ---------- Productos (stock = compras − ventas) ----------
async function cargarProductos() {
  const q = $('#pr-q').value.trim();
  let filas = await api(`/productos${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  logData('Productos: stock y últimos precios', filas);
  if ($('#pr-negativos').checked) filas = filas.filter((p) => p.stock < 0);
  pintarLista(
    'pr',
    filas,
    (p) => `<tr>
      <td>${esc(p.producto)}</td><td class="num">${num.format(p.comprado)}</td><td class="num">${num.format(p.vendido)}</td>
      <td class="num ${p.stock < 0 ? 'money-out' : p.stock === 0 ? 'low' : ''}"><strong>${num.format(p.stock)}</strong></td>
    </tr>`,
    4,
    'No hay productos con este filtro.',
  );
}
bindFiltros('pr', () => cargarProductos().catch((e) => toast(e.message)));
$('#pr-negativos').addEventListener('change', () => cargarProductos().catch((e) => toast(e.message)));

// ---------- Clientes (hoja Resumen clientes) ----------
async function cargarClientes() {
  const filas = await api(`/clientes/resumen${params('cl')}`);
  $('#cl-body').innerHTML = filas.length
    ? filas
        .map(
          (c) => `<tr><td>${esc(c.cliente)}</td><td class="num">${c.cantidadCompras}</td>
            <td class="num">${num.format(c.unidadesCompradas)}</td><td class="num"><strong>${money.format(c.totalComprado)}</strong></td></tr>`,
        )
        .join('')
    : emptyRow(4, 'No hay ventas a clientes con estos filtros.');
  const suma = (k) => filas.reduce((s, v) => s + v[k], 0);
  $('#cl-foot').innerHTML = filas.length
    ? `<tr><td>Total (${filas.length} clientes)</td><td class="num">${suma('cantidadCompras')}</td>
       <td class="num">${num.format(suma('unidadesCompradas'))}</td><td class="num">${money.format(suma('totalComprado'))}</td></tr>`
    : '';
}
bindFiltros('cl', () => cargarClientes().catch((e) => toast(e.message)));

// ---------- Caja ----------
const CONCEPTO = { VENTA_MOSTRADOR: 'Venta mostrador', VENTA_CLIENTE: 'Venta a cliente', COMPRA: 'Compra' };

async function cargarCaja() {
  const { totales, movimientos } = await api(`/caja${params('ca')}`);
  $('#ca-ingresos').textContent = money.format(totales.ingresos);
  $('#ca-ingresos-det').textContent = `Mostrador ${money.format(totales.ventasMostrador)} · Clientes ${money.format(totales.ventasClientes)}`;
  $('#ca-pagos').textContent = `${money.format(totales.efectivo)} / ${money.format(totales.nequi)}`;
  $('#ca-egresos').textContent = money.format(totales.egresos);
  $('#ca-saldo').textContent = money.format(totales.saldo);
  $('#ca-saldo-card').classList.toggle('negative', totales.saldo < 0);
  logData('Caja: movimientos', movimientos);
  pintarCajaChart(movimientos);
  pintarLista(
    'ca',
    movimientos,
    (m) => `<tr>
      <td>${fechaTexto(m.fecha)}</td><td><span class="badge ${m.concepto}">${CONCEPTO[m.concepto]}</span></td>
      <td>${esc(m.detalle)}</td><td>${esc(m.tercero)}</td><td>${esc(m.pago)}</td>
      <td class="num"><strong class="${m.valor < 0 ? 'money-out' : 'money-in'}">${m.valor < 0 ? '− ' : '+ '}${money.format(Math.abs(m.valor))}</strong></td>
      <td class="num ${m.saldo < 0 ? 'money-out' : ''}">${money.format(m.saldo)}</td>
    </tr>`,
    7,
    'No hay movimientos con estos filtros.',
  );
}
bindFiltros('ca', () => cargarCaja().catch((e) => toast(e.message)));

/** Gráfico de barras: ingresos vs egresos por mes (o por día si el rango es corto). */
function pintarCajaChart(movs) {
  const chart = $('#ca-chart');
  if (!movs.length) {
    chart.innerHTML = '<p class="chart-empty">Sin movimientos</p>';
    chart.nextElementSibling?.classList.contains('bar-labels') && chart.nextElementSibling.remove();
    return;
  }
  const fechas = movs.map((m) => m.fecha).sort();
  const dias = (Date.parse(fechas.at(-1)) - Date.parse(fechas[0])) / 86_400_000 + 1;
  const porMes = dias > 45;
  $('#ca-chart-title').textContent = porMes ? 'Ingresos y egresos por mes' : 'Ingresos y egresos por día';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const grupos = new Map();
  const key = (f) => (porMes ? f.slice(0, 7) : f);
  // Todos los periodos del rango, aunque no tengan movimientos.
  const inicio = new Date(`${fechas[0]}T00:00:00`);
  const fin = new Date(`${fechas.at(-1)}T00:00:00`);
  for (let d = new Date(inicio); d <= fin; porMes ? d.setMonth(d.getMonth() + 1, 1) : d.setDate(d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${porMes ? '' : `-${String(d.getDate()).padStart(2, '0')}`}`;
    grupos.set(k, { ingresos: 0, egresos: 0 });
  }
  for (const m of movs) {
    const g = grupos.get(key(m.fecha));
    if (!g) continue;
    if (m.valor >= 0) g.ingresos += m.valor;
    else g.egresos += -m.valor;
  }
  const lista = [...grupos.entries()];
  const max = Math.max(...lista.map(([, g]) => Math.max(g.ingresos, g.egresos)), 1);
  const etiqueta = (k) => (porMes ? `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}` : `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`);
  chart.innerHTML = lista
    .map(
      ([k, g]) => `<div class="bar-col">
        <span class="tip">${esc(etiqueta(k))}: +${money.format(g.ingresos)} / −${money.format(g.egresos)}</span>
        <div class="bar ${g.ingresos ? '' : 'zero'}" style="height:${(g.ingresos / max) * 100}%"></div>
        <div class="bar out ${g.egresos ? '' : 'zero'}" style="height:${(g.egresos / max) * 100}%"></div>
      </div>`,
    )
    .join('');
  let labels = chart.nextElementSibling;
  if (!labels || !labels.classList.contains('bar-labels')) {
    labels = document.createElement('div');
    labels.className = 'bar-labels';
    chart.after(labels);
  }
  const cada = Math.ceil(lista.length / 12);
  labels.innerHTML = lista.map(([k], i) => `<span>${i % cada === 0 ? esc(etiqueta(k)) : ''}</span>`).join('');
}

// ---------- Formularios ----------
const FORMS = {
  mostrador: { dlg: '#dlg-mostrador', form: '#form-mostrador', titulo: '#t-mostrador', error: '#e-mostrador', ruta: '/ventas-mostrador', nombre: 'venta de mostrador' },
  cliente: { dlg: '#dlg-cliente', form: '#form-cliente', titulo: '#t-cliente', error: '#e-cliente', ruta: '/ventas-clientes', nombre: 'venta a cliente' },
  compra: { dlg: '#dlg-compra', form: '#form-compra', titulo: '#t-compra', error: '#e-compra', ruta: '/compras', nombre: 'compra' },
};

async function abrirForm(tipo, registro) {
  const cfg = FORMS[tipo];
  await cargarOpciones().catch(() => {});
  const f = $(cfg.form);
  f.reset();
  $(cfg.error).textContent = '';
  $(cfg.titulo).textContent = `${registro ? 'Editar' : 'Nueva'} ${cfg.nombre}`;
  f.elements.id.value = registro?.id ?? '';
  if (registro) {
    for (const el of f.elements) if (el.name && el.name !== 'id' && registro[el.name] !== undefined) el.value = registro[el.name];
  } else {
    const fecha = f.elements.fecha || f.elements.fechaFactura;
    fecha.value = hoy();
  }
  actualizarTotales();
  $(cfg.dlg).showModal();
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-nuevo],[data-editar],[data-borrar],[data-close],[data-pagar]');
  if (!btn) return;
  const { nuevo, editar, borrar, id, pagar } = btn.dataset;
  try {
    if (nuevo) await abrirForm(nuevo);
    if (editar) await abrirForm(editar, await api(`${FORMS[editar].ruta}/${id}`));
    if (borrar && confirmar(`¿Eliminar esta ${FORMS[borrar].nombre}?`)) {
      await api(`${FORMS[borrar].ruta}/${id}`, { method: 'DELETE' });
      toast('Registro eliminado');
      CARGAS[state.tab]();
    }
    if (btn.hasAttribute('data-close')) btn.closest('dialog').close();
    if (pagar) {
      const f = $('#form-mostrador');
      const total = totalDe(f, 'valorUnitario');
      f.elements.pagoEfectivo.value = pagar === 'efectivo' ? total : 0;
      f.elements.pagoNequi.value = pagar === 'nequi' ? total : 0;
    }
  } catch (err) {
    toast(err.message);
  }
});

function confirmar(msg) {
  try {
    return window.confirm(msg);
  } catch {
    return true;
  }
}

function totalDe(form, campoPrecio) {
  return Math.round(Number(form.elements.cantidad.value || 0) * Number(form.elements[campoPrecio].value || 0) * 100) / 100;
}

function actualizarTotales() {
  $('#m-total').textContent = money.format(totalDe($('#form-mostrador'), 'valorUnitario'));
  $('#c-total').textContent = money.format(totalDe($('#form-cliente'), 'precioUnitario'));
  $('#p-total').textContent = money.format(totalDe($('#form-compra'), 'precioUnitario'));
}
document.querySelectorAll('dialog input').forEach((el) => el.addEventListener('input', actualizarTotales));

// Al escribir un producto conocido, se propone su último precio (de venta o de compra).
function proponerPrecio(input, campo, tipo) {
  input.addEventListener('change', () => {
    const f = input.form;
    if (f.elements.id.value || f.elements[campo].value) return;
    const p = buscarProducto(input.value);
    const precio = tipo === 'compra' ? p?.precioCompra : p?.precioVenta;
    if (precio) {
      f.elements[campo].value = precio;
      actualizarTotales();
    }
  });
}
proponerPrecio($('#form-mostrador').elements.producto, 'valorUnitario', 'venta');
proponerPrecio($('#form-cliente').elements.descripcion, 'precioUnitario', 'venta');
proponerPrecio($('#form-compra').elements.descripcion, 'precioUnitario', 'compra');

function datosForm(f) {
  const datos = {};
  for (const el of f.elements) {
    if (!el.name || el.name === 'id') continue;
    if (el.type === 'number') {
      if (el.value !== '') datos[el.name] = Number(el.value);
    } else datos[el.name] = el.value.trim();
  }
  return datos;
}

for (const [tipo, cfg] of Object.entries(FORMS)) {
  $(cfg.form).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const id = f.elements.id.value;
    // Campos numéricos vacíos no se envían: en una venta de mostrador sin pagos, el servidor la registra en efectivo.
    const datos = datosForm(f);
    try {
      await api(id ? `${cfg.ruta}/${id}` : cfg.ruta, { method: id ? 'PATCH' : 'POST', body: datos });
      $(cfg.dlg).close();
      toast(id ? 'Cambios guardados' : 'Registro guardado');
      state.opciones = null;
      CARGAS[state.tab]();
    } catch (err) {
      $(cfg.error).textContent = err.message;
    }
  });
}

// ---------- Inicio ----------
state.tab = 'resumen';
state.sub = 'mostrador';
cargarResumen().catch((err) => toast(err.message));
api('/info')
  .then((info) => {
    $('#demo-banner').hidden = info.persistent;
    console.info('[Inventario] Instalación', info);
  })
  .catch(() => {});
