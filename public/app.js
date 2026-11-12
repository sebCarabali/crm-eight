// Interfaz del inventario: JavaScript sin dependencias que consume la API REST (/api).

const state = { categories: [], products: [] };

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' });
const TYPE_LABEL = { IN: 'Entrada', OUT: 'Salida', ADJUST: 'Ajuste' };

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
  ({ dashboard: loadDashboard, products: loadProducts, categories: loadCategories, movements: loadMovements })[name]();
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
  const filter = $('#movement-product-filter');
  const current = filter.value;
  filter.innerHTML = `<option value="">Todos los productos</option>${opts}`;
  filter.value = current;
  $('#movement-form [name=productId]').innerHTML = opts;
}

// ---------- Resumen ----------
async function loadDashboard() {
  const s = await api('/products/summary');
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
            <td class="num">${m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : '='}${m.quantity}</td>
            <td class="num">${m.previousStock}</td>
            <td class="num">${m.newStock}</td>
            <td>${esc(m.reason ?? '')}</td>
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
  updateMovementHint();
  $('#movement-dialog').showModal();
}

function updateMovementHint() {
  const form = $('#movement-form');
  const product = state.products.find((p) => p.id === Number(form.productId.value));
  const isAdjust = form.type.value === 'ADJUST';
  $('#quantity-label').textContent = isAdjust ? 'Stock contado' : 'Cantidad';
  form.quantity.min = isAdjust ? 0 : 1;
  $('#movement-hint').textContent = product
    ? `Stock actual: ${product.stock}` + (isAdjust ? ' — el stock quedará en la cantidad contada.' : '')
    : '';
}

$('#movement-form [name=productId]').addEventListener('change', updateMovementHint);
$('#movement-form [name=type]').addEventListener('change', updateMovementHint);

$('#movement-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const m = await api('/movements', {
      method: 'POST',
      body: {
        productId: Number(f.productId.value),
        type: f.type.value,
        quantity: Number(f.quantity.value),
        reason: f.reason.value.trim() || undefined,
      },
    });
    toast(`${TYPE_LABEL[m.type]} registrada. Nuevo stock: ${m.newStock}`);
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
