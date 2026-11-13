import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportesService, claveProducto } from '../reportes/reportes.service';
import { ActualizarProductoDto, CrearProductoDto } from './dto';
import { Producto } from './entidades';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto) private readonly repo: Repository<Producto>,
    private readonly reportes: ReportesService,
  ) {}

  async obtener(id: number): Promise<Producto> {
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException(`Producto ${id} no encontrado`);
    return p;
  }

  async crear(dto: CrearProductoDto): Promise<Producto> {
    const clave = claveProducto(dto.producto);
    await this.validarNombreLibre(clave);
    return this.repo.save(this.repo.create({ producto: dto.producto, cantidad: dto.cantidad, clave }));
  }

  async actualizar(id: number, dto: ActualizarProductoDto): Promise<Producto> {
    const p = await this.obtener(id);
    if (dto.producto !== undefined) {
      const clave = claveProducto(dto.producto);
      if (clave !== p.clave) await this.validarNombreLibre(clave);
      p.producto = dto.producto;
      p.clave = clave;
    }
    if (dto.cantidad !== undefined) p.cantidad = dto.cantidad;
    return this.repo.save(p);
  }

  async eliminar(id: number): Promise<void> {
    await this.repo.remove(await this.obtener(id));
  }

  /** El nombre no puede existir ya: ni como producto creado, ni en compras o ventas. */
  private async validarNombreLibre(clave: string) {
    const existe =
      (await this.repo.existsBy({ clave })) ||
      (await this.reportes.nombresConocidos()).has(clave);
    if (existe) throw new ConflictException('Ya existe un producto con ese nombre');
  }
}
