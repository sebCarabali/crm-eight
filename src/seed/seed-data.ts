/**
 * Datos de prueba: tienda de barrio colombiana.
 * Precios de referencia en pesos colombianos (COP).
 *
 * popularity: qué tanto se vende (1 = poco, 10 = muchísimo). Se usa para
 * generar un historial de ventas realista.
 */
export interface SeedProduct {
  sku: string;
  name: string;
  price: number;
  minStock: number;
  stock: number;
  popularity: number;
}

export interface SeedCategory {
  name: string;
  description: string;
  products: SeedProduct[];
}

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: 'Bebidas',
    description: 'Gaseosas, jugos, agua y maltas',
    products: [
      { sku: 'BEB-001', name: 'Gaseosa Coca-Cola 400 ml', price: 3000, minStock: 24, stock: 72, popularity: 10 },
      { sku: 'BEB-002', name: 'Gaseosa Coca-Cola 1.5 L', price: 6500, minStock: 12, stock: 36, popularity: 7 },
      { sku: 'BEB-003', name: 'Gaseosa Postobón Manzana 400 ml', price: 2500, minStock: 24, stock: 60, popularity: 8 },
      { sku: 'BEB-004', name: 'Gaseosa Colombiana 1.5 L', price: 5500, minStock: 12, stock: 30, popularity: 6 },
      { sku: 'BEB-005', name: 'Pony Malta 330 ml', price: 2500, minStock: 24, stock: 48, popularity: 8 },
      { sku: 'BEB-006', name: 'Agua Cristal 600 ml', price: 1800, minStock: 24, stock: 48, popularity: 7 },
      { sku: 'BEB-007', name: 'Jugo Hit Mora 500 ml', price: 3200, minStock: 12, stock: 30, popularity: 5 },
      { sku: 'BEB-008', name: 'Avena Alpina 250 ml', price: 2800, minStock: 12, stock: 24, popularity: 5 },
    ],
  },
  {
    name: 'Lácteos y huevos',
    description: 'Leche, quesos, kumis, mantequilla y huevos',
    products: [
      { sku: 'LAC-001', name: 'Leche entera Alquería 1 L (bolsa)', price: 4600, minStock: 20, stock: 40, popularity: 10 },
      { sku: 'LAC-002', name: 'Huevos AA x 30', price: 19500, minStock: 5, stock: 12, popularity: 6 },
      { sku: 'LAC-003', name: 'Huevo AA unidad', price: 700, minStock: 30, stock: 90, popularity: 9 },
      { sku: 'LAC-004', name: 'Queso campesino 250 g', price: 7500, minStock: 6, stock: 15, popularity: 6 },
      { sku: 'LAC-005', name: 'Kumis Alpina 200 g', price: 2600, minStock: 10, stock: 20, popularity: 4 },
      { sku: 'LAC-006', name: 'Mantequilla 125 g', price: 4200, minStock: 6, stock: 12, popularity: 3 },
    ],
  },
  {
    name: 'Panadería',
    description: 'Pan, arepas y productos horneados',
    products: [
      { sku: 'PAN-001', name: 'Pan tajado Bimbo 600 g', price: 8900, minStock: 6, stock: 15, popularity: 6 },
      { sku: 'PAN-002', name: 'Pan aliñado unidad', price: 600, minStock: 30, stock: 80, popularity: 10 },
      { sku: 'PAN-003', name: 'Almojábana', price: 1500, minStock: 15, stock: 40, popularity: 7 },
      { sku: 'PAN-004', name: 'Pandebono', price: 1500, minStock: 15, stock: 40, popularity: 7 },
      { sku: 'PAN-005', name: 'Arepas de maíz blanco x 5', price: 3800, minStock: 10, stock: 25, popularity: 8 },
    ],
  },
  {
    name: 'Granos y abarrotes',
    description: 'Arroz, fríjol, lenteja, azúcar, panela, aceite y pastas',
    products: [
      { sku: 'ABA-001', name: 'Arroz Diana 1 kg', price: 4800, minStock: 15, stock: 40, popularity: 9 },
      { sku: 'ABA-002', name: 'Arroz Diana 500 g', price: 2500, minStock: 15, stock: 40, popularity: 8 },
      { sku: 'ABA-003', name: 'Fríjol bola roja 500 g', price: 6200, minStock: 8, stock: 20, popularity: 5 },
      { sku: 'ABA-004', name: 'Lenteja 500 g', price: 3800, minStock: 8, stock: 20, popularity: 5 },
      { sku: 'ABA-005', name: 'Panela redonda 500 g', price: 3000, minStock: 10, stock: 25, popularity: 7 },
      { sku: 'ABA-006', name: 'Azúcar Manuelita 1 kg', price: 4700, minStock: 10, stock: 25, popularity: 6 },
      { sku: 'ABA-007', name: 'Aceite vegetal 1 L', price: 9800, minStock: 6, stock: 15, popularity: 5 },
      { sku: 'ABA-008', name: 'Espaguetis Doria 250 g', price: 2400, minStock: 10, stock: 30, popularity: 6 },
      { sku: 'ABA-009', name: 'Harina P.A.N. 1 kg', price: 5600, minStock: 6, stock: 15, popularity: 4 },
    ],
  },
  {
    name: 'Café y chocolate',
    description: 'Café molido, chocolate de mesa y bebidas calientes',
    products: [
      { sku: 'CAF-001', name: 'Café Sello Rojo 250 g', price: 9500, minStock: 6, stock: 18, popularity: 6 },
      { sku: 'CAF-002', name: 'Café Águila Roja 125 g', price: 4900, minStock: 6, stock: 18, popularity: 5 },
      { sku: 'CAF-003', name: 'Chocolate Corona 250 g', price: 6800, minStock: 6, stock: 15, popularity: 4 },
    ],
  },
  {
    name: 'Enlatados y conservas',
    description: 'Atún, sardinas, salchichas y conservas',
    products: [
      { sku: 'ENL-001', name: 'Atún Van Camps en aceite 160 g', price: 6900, minStock: 8, stock: 20, popularity: 5 },
      { sku: 'ENL-002', name: 'Sardinas en salsa de tomate 425 g', price: 7200, minStock: 5, stock: 12, popularity: 3 },
      { sku: 'ENL-003', name: 'Salchichas Zenú lata 150 g', price: 4500, minStock: 6, stock: 15, popularity: 4 },
    ],
  },
  {
    name: 'Carnes frías',
    description: 'Salchichón, mortadela, jamón y salchichas',
    products: [
      { sku: 'CFR-001', name: 'Salchichón cervecero 450 g', price: 9900, minStock: 4, stock: 10, popularity: 4 },
      { sku: 'CFR-002', name: 'Mortadela 250 g', price: 4800, minStock: 4, stock: 10, popularity: 4 },
      { sku: 'CFR-003', name: 'Salchicha ranchera x 5', price: 6500, minStock: 4, stock: 10, popularity: 5 },
    ],
  },
  {
    name: 'Mecato y paquetes',
    description: 'Papas, chitos, plátanos y paquetes',
    products: [
      { sku: 'MEC-001', name: 'Papas Margarita Pollo 25 g', price: 2300, minStock: 20, stock: 50, popularity: 9 },
      { sku: 'MEC-002', name: 'Papas Margarita Limón 25 g', price: 2300, minStock: 20, stock: 50, popularity: 7 },
      { sku: 'MEC-003', name: 'Choclitos Limón 45 g', price: 2200, minStock: 15, stock: 40, popularity: 7 },
      { sku: 'MEC-004', name: 'De Todito Natural 45 g', price: 3000, minStock: 12, stock: 30, popularity: 6 },
      { sku: 'MEC-005', name: 'Chicharrón Natuchips 30 g', price: 2000, minStock: 12, stock: 30, popularity: 5 },
    ],
  },
  {
    name: 'Dulces y galletas',
    description: 'Confitería, chocolatinas, ponqués y galletas',
    products: [
      { sku: 'DUL-001', name: 'Bon Bon Bum', price: 600, minStock: 40, stock: 100, popularity: 9 },
      { sku: 'DUL-002', name: 'Chocoramo', price: 2600, minStock: 15, stock: 40, popularity: 8 },
      { sku: 'DUL-003', name: 'Chocolatina Jet 12 g', price: 900, minStock: 30, stock: 80, popularity: 8 },
      { sku: 'DUL-004', name: 'Gol chocolatina', price: 1500, minStock: 20, stock: 50, popularity: 6 },
      { sku: 'DUL-005', name: 'Galletas Festival x 4', price: 1300, minStock: 20, stock: 50, popularity: 7 },
      { sku: 'DUL-006', name: 'Galletas Saltín Noel taco', price: 2500, minStock: 10, stock: 30, popularity: 6 },
      { sku: 'DUL-007', name: 'Bocadillo veleño x 6', price: 2500, minStock: 10, stock: 25, popularity: 4 },
    ],
  },
  {
    name: 'Condimentos y salsas',
    description: 'Sal, caldos, salsas y aliños',
    products: [
      { sku: 'CON-001', name: 'Sal Refisal 500 g', price: 1600, minStock: 8, stock: 20, popularity: 5 },
      { sku: 'CON-002', name: 'Caldo Ricostilla x 2 cubos', price: 1000, minStock: 20, stock: 50, popularity: 7 },
      { sku: 'CON-003', name: 'Salsa de tomate Fruco 200 g', price: 3900, minStock: 6, stock: 15, popularity: 4 },
      { sku: 'CON-004', name: 'Mayonesa Fruco 200 g', price: 4600, minStock: 6, stock: 15, popularity: 4 },
      { sku: 'CON-005', name: 'Color El Rey sobre', price: 500, minStock: 20, stock: 50, popularity: 5 },
    ],
  },
  {
    name: 'Frutas y verduras',
    description: 'Productos frescos por unidad o libra',
    products: [
      { sku: 'FRU-001', name: 'Plátano verde unidad', price: 1200, minStock: 20, stock: 60, popularity: 8 },
      { sku: 'FRU-002', name: 'Papa pastusa libra', price: 1500, minStock: 20, stock: 60, popularity: 8 },
      { sku: 'FRU-003', name: 'Tomate chonto libra', price: 2500, minStock: 10, stock: 30, popularity: 7 },
      { sku: 'FRU-004', name: 'Cebolla larga atado', price: 1500, minStock: 10, stock: 25, popularity: 6 },
      { sku: 'FRU-005', name: 'Limón Tahití unidad', price: 400, minStock: 30, stock: 80, popularity: 6 },
      { sku: 'FRU-006', name: 'Yuca libra', price: 1800, minStock: 10, stock: 30, popularity: 5 },
    ],
  },
  {
    name: 'Aseo del hogar',
    description: 'Jabones, detergentes, blanqueadores y papel',
    products: [
      { sku: 'ASH-001', name: 'Jabón Rey barra 300 g', price: 3600, minStock: 10, stock: 25, popularity: 6 },
      { sku: 'ASH-002', name: 'Detergente Fab 500 g', price: 6900, minStock: 6, stock: 15, popularity: 5 },
      { sku: 'ASH-003', name: 'Límpido 1 L', price: 4800, minStock: 6, stock: 15, popularity: 4 },
      { sku: 'ASH-004', name: 'Papel higiénico Familia x 4', price: 7900, minStock: 6, stock: 15, popularity: 5 },
      { sku: 'ASH-005', name: 'Esponjilla Bon Brill', price: 1500, minStock: 10, stock: 25, popularity: 4 },
    ],
  },
  {
    name: 'Aseo personal',
    description: 'Jabón de baño, crema dental, champú y cuidado personal',
    products: [
      { sku: 'ASP-001', name: 'Jabón Protex 110 g', price: 3900, minStock: 6, stock: 15, popularity: 4 },
      { sku: 'ASP-002', name: 'Crema dental Colgate 75 ml', price: 5900, minStock: 6, stock: 15, popularity: 4 },
      { sku: 'ASP-003', name: 'Champú sobre', price: 800, minStock: 20, stock: 50, popularity: 5 },
      { sku: 'ASP-004', name: 'Toallas higiénicas Nosotras x 10', price: 5600, minStock: 5, stock: 12, popularity: 3 },
    ],
  },
  {
    name: 'Cervezas y licores',
    description: 'Cerveza y aguardiente (venta solo a mayores de edad)',
    products: [
      { sku: 'LIC-001', name: 'Cerveza Águila lata 330 ml', price: 3500, minStock: 24, stock: 72, popularity: 8 },
      { sku: 'LIC-002', name: 'Cerveza Poker lata 330 ml', price: 3500, minStock: 24, stock: 72, popularity: 8 },
      { sku: 'LIC-003', name: 'Cerveza Club Colombia 330 ml', price: 4200, minStock: 12, stock: 36, popularity: 5 },
      { sku: 'LIC-004', name: 'Aguardiente Antioqueño media', price: 32000, minStock: 3, stock: 8, popularity: 2 },
    ],
  },
];

/** Motivos de las salidas que no son ventas de mostrador. */
export const OUT_REASONS = ['Venta a crédito (fiado)', 'Pedido a domicilio', 'Venta al por mayor', 'Consumo interno'];
export const SALE_NOTES = ['', '', '', '', 'Cliente frecuente', 'Pago con Nequi', 'Pago con Daviplata', 'Domicilio'];
