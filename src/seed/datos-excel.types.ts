/** Estructura de los datos importados del Excel (una propiedad por hoja). */
export interface DatosExcel {
  ventasMostrador: {
    fecha: string;
    producto: string;
    cantidad: number;
    valorUnitario: number;
    valorTotal: number;
    pagoEfectivo: number;
    pagoNequi: number;
  }[];
  compras: {
    proveedor: string;
    fechaFactura: string;
    clienteDestino: string;
    cantidad: number;
    descripcion: string;
    precioUnitario: number;
    valorTotal: number;
  }[];
  ventasClientes: {
    cliente: string;
    fecha: string;
    condicionesPago: string;
    cantidad: number;
    descripcion: string;
    precioUnitario: number;
    valorTotal: number;
  }[];
}
