// Interfaz del inventario: JavaScript sin dependencias que consume la API REST (/api).

const state = { categories: [], products: [] };

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' });
const TYPE_LABEL = { IN: 'Entrada', OUT: 'Salida', ADJUST: 'Ajuste', SALE: 'Venta' };
const TYPE_DONE = { IN: 'Entrada registrada', OUT: 'Salida registrada', ADJUST: 'Ajuste registrado', SALE: 'Venta registrada' };
const TYPE_SIGN = { IN: '+', OUT: '−', SALE: '−', ADJUST: '=' };

const $ = (sel) => document.querySelector(sel);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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

function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" class="empty">${text}</td></tr>`;
}

// ---------- Pestañas ----------
document.querySelectorAll('.tabs button').forEach((btn) => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

function showTab(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${name}`));
  const loaders = { dashboard: loadDashboard, sales: loadSales, products: loadProducts, categories: loadCategories, movements: loadMovements };
  loaders[name]().catch((err) => toast(err.message));
}

// ---------- Datos compartidos ----------
async function refreshCategories() {
  state.categories = await api('/categories');
  const opts = state.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const filter = $('#product-category-filter');
  const current = filter.value;
  filter.innerHTML = `<option value="">Todas las categorías</option>${opts}`;
  filter.value = current;
  $('#product-form [name=categoryId]').innerHTML = `<option value="">(Sin categoría)</option>${opts}`;
}

async function refreshProductOptions() {
  state.products = await api('/products');
  const opts = state.products.map((p) => `<option value="${p.id}">${esc(p.sku)} — ${esc(p.name)} (stock: ${p.stock})</option>`).join('');
  const simpleOpts = state.products.map((p) => `<option value="${p.id}">${esc(p.sku)} — ${esc(p.name)}</option>`).join('');
  for (const sel of ['#movement-product-filter', '#sales-product-filter']) {
    const filter = $(sel);
    const current = filter.value;
    filter.innerHTML = `<option value="">Todos los productos</option>${simpleOpts}`;
    filter.value = current;
  }
  $('#movement-form [name=productId]').innerHTML = opts;
}

// Rango de fechas local → instantes ISO para la API ("hasta" es inclusive en la UI).
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function toInputDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromInputDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ---------- Resumen ----------
async function loadDashboard() {
  const today = startOfDay(new Date());
  const [s, todaySales] = await Promise.all([
    api('/products/summary'),
    api(`/sales?from=${today.toISOString()}&to=${addDays(today, 1).toISOString()}`),
  ]);
  $('#sum-sales-today').textContent = money.format(todaySales.totals.revenue);
  $('#sum-products').textContent = s.totalProducts;
  $('#sum-units').textContent = s.totalUnits.toLocaleString('es-CO');
  $('#sum-value').textContent = money.format(s.inventoryValue);
  $('#sum-low').textContent = s.lowStockCount;
  $('#low-stock-body').innerHTML = s.lowStock.length
    ? s.lowStock
        .map(
          (p) => `<tr>
            <td class="sku">${esc(p.sku)}</td><td>${esc(p.name)}</td>
            <td class="low">${p.stock}</td><td>${p.minStock}</td>
            <td class="actions-cell"><button class="link" data-restock="${p.id}">Registrar entrada</button></td>
          </tr>`,
        )
        .join('')
    : emptyRow(5, 'Todo en orden: ningún producto está por debajo del mínimo 🎉');
}

$('#low-stock-body').addEventListener('click', (e) => {
  const id = e.target.dataset.restock;
  if (id) openMovementDialog(Number(id), 'IN');
});

// ---------- Ventas ----------
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function applySalesPreset(preset) {
  const today = startOfDay(new Date());
  let from = null;
  if (preset === 'today') from = today;
  if (preset === '7d') from = addDays(today, -6);
  if (preset === '30d') from = addDays(today, -29);
  if (preset === 'month') from = new Date(today.getFullYear(), today.getMonth(), 1);
  $('#sales-from').value = from ? toInputDate(from) : '';
  $('#sales-to').value = from ? toInputDate(today) : '';
  document.querySelectorAll('#sales-presets button').forEach((b) => b.classList.toggle('active', b.dataset.preset === preset));
}

async function loadSales() {
  await refreshProductOptions();
  if (!loadSales.initialized) {
    applySalesPreset('30d');
    loadSales.initialized = true;
  }
  const params = new URLSearchParams();
  const fromVal = $('#sales-from').value;
  const toVal = $('#sales-to').value;
  if (fromVal) params.set('from', fromInputDate(fromVal).toISOString());
  if (toVal) params.set('to', addDays(fromInputDate(toVal), 1).toISOString());
  if ($('#sales-product-filter').value) params.set('productId', $('#sales-product-filter').value);

  const report = await api(`/sales?${params}`);
  const { totals, topProducts, sales } = report;

  $('#sales-revenue').textContent = money.format(totals.revenue);
  $('#sales-count').textContent = totals.count;
  $('#sales-units').textContent = totals.units.toLocaleString('es-CO');
  $('#sales-avg').textContent = money.format(totals.averageTicket);

  renderSalesChart(sales, fromVal ? fromInputDate(fromVal) : null, toVal ? fromInputDate(toVal) : null);

  $('#top-products-body').innerHTML = topProducts.length
    ? topProducts
        .map(
          (t) => `<tr>
            <td><span class="sku">${esc(t.sku)}</span> ${esc(t.name)}</td>
            <td class="num">${t.units}</td>
            <td class="num">${money.format(t.revenue)}</td>
          </tr>`,
        )
        .join('')
    : emptyRow(3, 'Sin ventas en este periodo');

  state.sales = sales;
  state.salesShown = SALES_PAGE;
  renderSalesRows();
}

const SALES_PAGE = 25;

function renderSalesRows() {
  const sales = state.sales;
  const visible = sales.slice(0, state.salesShown);
  const more = $('#sales-more');
  more.hidden = sales.length <= state.salesShown;
  more.textContent = `Mostrar más (${sales.length - visible.length} restantes)`;
  $('#sales-body').innerHTML = sales.length
    ? visible
        .map(
          (s) => `<tr>
            <td>${dateFmt.format(new Date(s.createdAt))}</td>
            <td><span class="sku">${esc(s.product.sku)}</span> ${esc(s.product.name)}</td>
            <td class="num">${s.quantity}</td>
            <td class="num">${money.format(s.unitPrice)}</td>
            <td class="num"><strong>${money.format(s.total)}</strong></td>
            <td>${esc(s.reason ?? '')}</td>
          </tr>`,
        )
        .join('')
    : emptyRow(6, 'No hay ventas en este periodo. Registra una con “+ Nueva venta”.');
}

/** Gráfico de barras por día (o por mes si el rango es largo). */
function renderSalesChart(sales, from, to) {
  const chart = $('#sales-chart');
  const dates = sales.map((s) => startOfDay(new Date(s.createdAt)));
  const today = startOfDay(new Date());
  const start = from ?? (dates.length ? new Date(Math.min(...dates)) : addDays(today, -6));
  const end = to ?? today;
  const spanDays = Math.round((end - start) / 86_400_000) + 1;
  const byMonth = spanDays > 62;
  $('#sales-chart-title').textContent = byMonth ? 'Ventas por mes' : 'Ventas por día';

  const buckets = [];
  const index = new Map();
  if (byMonth) {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      index.set(key, buckets.length);
      buckets.push({ label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, full: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, total: 0 });
    }
  } else {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      index.set(d.getTime(), buckets.length);
      buckets.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, full: d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }), total: 0 });
    }
  }
  sales.forEach((s, i) => {
    const d = dates[i];
    const key = byMonth ? `${d.getFullYear()}-${d.getMonth()}` : d.getTime();
    const pos = index.get(key);
    if (pos !== undefined) buckets[pos].total += s.total;
  });

  if (!sales.length) {
    chart.innerHTML = '<p class="chart-empty">Sin ventas en este periodo</p>';
    chart.nextElementSibling?.classList.contains('bar-labels') && chart.nextElementSibling.remove();
    return;
  }
  const max = Math.max(...buckets.map((b) => b.total), 1);
  chart.innerHTML = buckets
    .map(
      (b) => `<div class="bar-col">
        <span class="tip">${esc(b.full)}: ${money.format(b.total)}</span>
        <div class="bar ${b.total ? '' : 'zero'}" style="height:${(b.total / max) * 100}%"></div>
      </div>`,
    )
    .join('');
  // Etiquetas: si hay muchas barras, mostrar solo algunas para que no se encimen.
  const every = Math.ceil(buckets.length / 12);
  let labels = chart.nextElementSibling;
  if (!labels || !labels.classList.contains('bar-labels')) {
    labels = document.createElement('div');
    labels.className = 'bar-labels';
    chart.after(labels);
  }
  labels.innerHTML = buckets.map((b, i) => `<span>${i % every === 0 ? esc(b.label) : ''}</span>`).join('');
}

document.querySelectorAll('#sales-presets button').forEach((btn) =>
  btn.addEventListener('click', () => {
    applySalesPreset(btn.dataset.preset);
    loadSales();
  }),
);
for (const sel of ['#sales-from', '#sales-to']) {
  $(sel).addEventListener('change', () => {
    document.querySelectorAll('#sales-presets button').forEach((b) => b.classList.remove('active'));
    loadSales();
  });
}
$('#sales-product-filter').addEventListener('change', loadSales);
$('#sales-more').addEventListener('click', () => {
  state.salesShown += SALES_PAGE;
  renderSalesRows();
});
$('#new-sale-btn').addEventListener('click', () => openMovementDialog(null, 'SALE'));

// ---------- Productos ----------
async function loadProducts() {
  await refreshCategories();
  const params = new URLSearchParams();
  const search = $('#product-search').value.trim();
  if (search) params.set('search', search);
  if ($('#product-category-filter').value) params.set('categoryId', $('#product-category-filter').value);
  if ($('#product-low-filter').checked) params.set('lowStock', 'true');

  const products = await api(`/products?${params}`);
  $('#products-body').innerHTML = products.length
    ? products
        .map(
          (p) => `<tr>
            <td class="sku">${esc(p.sku)}</td>
            <td>${esc(p.name)}</td>
            <td>${esc(p.category?.name ?? '—')}</td>
            <td class="num">${money.format(p.price)}</td>
            <td class="num ${p.stock <= p.minStock ? 'low' : ''}">${p.stock}</td>
            <td class="num">${p.minStock}</td>
            <td class="actions-cell">
              <button class="link" data-move="${p.id}">Movimiento</button>
              <button class="link" data-edit="${p.id}">Editar</button>
              <button class="link danger" data-delete="${p.id}">Eliminar</button>
            </td>
          </tr>`,
        )
        .join('')
    : emptyRow(7, 'No hay productos. Crea el primero con “+ Nuevo producto”.');
}

let searchTimer;
$('#product-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProducts, 250);
});
$('#product-category-filter').addEventListener('change', loadProducts);
$('#product-low-filter').addEventListener('change', loadProducts);
$('#new-product-btn').addEventListener('click', () => openProductDialog());

$('#products-body').addEventListener('click', async (e) => {
  const { move, edit, delete: del } = e.target.dataset;
  if (move) openMovementDialog(Number(move));
  if (edit) openProductDialog(await api(`/products/${edit}`));
  if (del && confirmDelete('¿Eliminar este producto y todo su historial de movimientos?')) {
    try {
      await api(`/products/${del}`, { method: 'DELETE' });
      toast('Producto eliminado');
      loadProducts();
    } catch (err) {
      toast(err.message);
    }
  }
});

function openProductDialog(product) {
  const form = $('#product-form');
  form.reset();
  $('#product-error').textContent = '';
  $('#product-dialog-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
  $('#initial-stock-field').style.display = product ? 'none' : '';
  if (product) {
    form.id.value = product.id;
    form.sku.value = product.sku;
    form.name.value = product.name;
    form.description.value = product.description ?? '';
    form.price.value = product.price;
    form.minStock.value = product.minStock;
    form.categoryId.value = product.category?.id ?? '';
  } else {
    form.id.value = '';
  }
  $('#product-dialog').showModal();
}

$('#product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    sku: f.sku.value.trim(),
    name: f.name.value.trim(),
    description: f.description.value.trim() || undefined,
    price: Number(f.price.value),
    minStock: Number(f.minStock.value || 0),
    categoryId: f.categoryId.value ? Number(f.categoryId.value) : null,
  };
  try {
    if (f.id.value) {
      await api(`/products/${f.id.value}`, { method: 'PATCH', body });
      toast('Producto actualizado');
    } else {
      body.initialStock = Number(f.initialStock.value || 0);
      await api('/products', { method: 'POST', body });
      toast('Producto creado');
    }
    $('#product-dialog').close();
    loadProducts();
  } catch (err) {
    $('#product-error').textContent = err.message;
  }
});

// ---------- Categorías ----------
async function loadCategories() {
  await refreshCategories();
  $('#categories-body').innerHTML = state.categories.length
    ? state.categories
        .map(
          (c) => `<tr>
            <td>${esc(c.name)}</td>
            <td>${esc(c.description ?? '')}</td>
            <td class="num">${c.productCount ?? 0}</td>
            <td class="actions-cell">
              <button class="link" data-edit="${c.id}">Editar</button>
              <button class="link danger" data-delete="${c.id}">Eliminar</button>
            </td>
          </tr>`,
        )
        .join('')
    : emptyRow(4, 'No hay categorías todavía.');
}

$('#new-category-btn').addEventListener('click', () => openCategoryDialog());

$('#categories-body').addEventListener('click', async (e) => {
  const { edit, delete: del } = e.target.dataset;
  if (edit) openCategoryDialog(state.categories.find((c) => c.id === Number(edit)));
  if (del && confirmDelete('¿Eliminar esta categoría?')) {
    try {
      await api(`/categories/${del}`, { method: 'DELETE' });
      toast('Categoría eliminada');
      loadCategories();
    } catch (err) {
      toast(err.message);
    }
  }
});

function openCategoryDialog(category) {
  const form = $('#category-form');
  form.reset();
  $('#category-error').textContent = '';
  $('#category-dialog-title').textContent = category ? 'Editar categoría' : 'Nueva categoría';
  form.id.value = category?.id ?? '';
  form.name.value = category?.name ?? '';
  form.description.value = category?.description ?? '';
  $('#category-dialog').showModal();
}

$('#category-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = { name: f.name.value.trim(), description: f.description.value.trim() || undefined };
  try {
    if (f.id.value) await api(`/categories/${f.id.value}`, { method: 'PATCH', body });
    else await api('/categories', { method: 'POST', body });
    toast('Categoría guardada');
    $('#category-dialog').close();
    loadCategories();
  } catch (err) {
    $('#category-error').textContent = err.message;
  }
});

// ---------- Movimientos ----------
async function loadMovements() {
  await refreshProductOptions();
  const params = new URLSearchParams();
  if ($('#movement-product-filter').value) params.set('productId', $('#movement-product-filter').value);
  if ($('#movement-type-filter').value) params.set('type', $('#movement-type-filter').value);
  const movements = await api(`/movements?${params}`);
  $('#movements-body').innerHTML = movements.length
    ? movements
        .map(
          (m) => `<tr>
            <td>${dateFmt.format(new Date(m.createdAt))}</td>
            <td><span class="sku">${esc(m.product.sku)}</span> ${esc(m.product.name)}</td>
            <td><span class="badge ${m.type}">${TYPE_LABEL[m.type]}</span></td>
            <td class="num">${TYPE_SIGN[m.type]}${m.quantity}</td>
            <td class="num">${m.previousStock}</td>
            <td class="num">${m.newStock}</td>
            <td>${esc(m.reason ?? '')}${m.type === 'SALE' && m.unitPrice != null ? ` <span class="sku">(${money.format(m.unitPrice * m.quantity)})</span>` : ''}</td>
          </tr>`,
        )
        .join('')
    : emptyRow(7, 'Sin movimientos registrados.');
}

$('#movement-product-filter').addEventListener('change', loadMovements);
$('#movement-type-filter').addEventListener('change', loadMovements);
$('#new-movement-btn').addEventListener('click', () => openMovementDialog());

async function openMovementDialog(productId, type = 'IN') {
  await refreshProductOptions();
  if (!state.products.length) {
    toast('Primero crea un producto');
    return;
  }
  const form = $('#movement-form');
  form.reset();
  $('#movement-error').textContent = '';
  if (productId) form.productId.value = productId;
  form.type.value = type;
  updateMovementHint(true);
  $('#movement-dialog').showModal();
}

function selectedProduct() {
  const form = $('#movement-form');
  return state.products.find((p) => p.id === Number(form.productId.value));
}

/** Ajusta el formulario según el tipo; resetPrice pone el precio actual del producto. */
function updateMovementHint(resetPrice = false) {
  const form = $('#movement-form');
  const product = selectedProduct();
  const type = form.type.value;
  const isAdjust = type === 'ADJUST';
  const isSale = type === 'SALE';
  $('#movement-dialog-title').textContent = isSale ? 'Nueva venta' : 'Registrar movimiento';
  $('#quantity-label').textContent = isAdjust ? 'Stock contado' : 'Cantidad';
  $('#reason-label').textContent = isSale ? 'Nota (cliente, factura…)' : 'Motivo';
  $('#sale-fields').style.display = isSale ? '' : 'none';
  form.unitPrice.required = isSale;
  form.quantity.min = isAdjust ? 0 : 1;
  if (isSale && product && (resetPrice || form.unitPrice.value === '')) form.unitPrice.value = product.price;
  $('#movement-hint').textContent = product
    ? `Stock actual: ${product.stock}` + (isAdjust ? ' — el stock quedará en la cantidad contada.' : '')
    : '';
  updateSaleTotal();
}

function updateSaleTotal() {
  const form = $('#movement-form');
  const total = Number(form.unitPrice.value || 0) * Number(form.quantity.value || 0);
  $('#sale-total').textContent = money.format(total);
}

$('#movement-form [name=productId]').addEventListener('change', () => updateMovementHint(true));
$('#movement-form [name=type]').addEventListener('change', () => updateMovementHint(false));
$('#movement-form [name=quantity]').addEventListener('input', updateSaleTotal);
$('#movement-form [name=unitPrice]').addEventListener('input', updateSaleTotal);

$('#movement-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    productId: Number(f.productId.value),
    type: f.type.value,
    quantity: Number(f.quantity.value),
    reason: f.reason.value.trim() || undefined,
  };
  if (body.type === 'SALE') body.unitPrice = Number(f.unitPrice.value);
  try {
    const m = await api('/movements', { method: 'POST', body });
    const extra = m.type === 'SALE' ? ` por ${money.format(m.unitPrice * m.quantity)}` : '';
    toast(`${TYPE_DONE[m.type]}${extra}. Nuevo stock: ${m.newStock}`);
    $('#movement-dialog').close();
    const active = document.querySelector('.tabs button.active').dataset.tab;
    showTab(active);
  } catch (err) {
    $('#movement-error').textContent = err.message;
  }
});

// ---------- Utilidades ----------
function confirmDelete(message) {
  // window.confirm funciona en navegadores normales; en algunos iframes (vista previa) puede estar bloqueado.
  try {
    return window.confirm(message);
  } catch {
    return true;
  }
}

document.querySelectorAll('[data-close]').forEach((btn) =>
  btn.addEventListener('click', () => btn.closest('dialog').close()),
);

loadDashboard().catch((err) => toast(err.message));
