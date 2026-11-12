import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { MovementType, StockMovement } from '../movements/stock-movement.entity';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './product.dto';
import { Product } from './product.entity';

export interface InventorySummary {
  totalProducts: number;
  totalUnits: number;
  inventoryValue: number;
  lowStockCount: number;
  lowStock: Product[];
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly categories: CategoriesService,
    private readonly dataSource: DataSource,
  ) {}

  findAll(query: ProductQueryDto = {}): Promise<Product[]> {
    const qb = this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .orderBy('p.name', 'ASC');

    if (query.search) {
      qb.andWhere('(LOWER(p.name) LIKE :s OR LOWER(p.sku) LIKE :s)', {
        s: `%${query.search.toLowerCase()}%`,
      });
    }
    if (query.categoryId) qb.andWhere('c.id = :cid', { cid: query.categoryId });
    if (query.lowStock) qb.andWhere('p.stock <= p.minStock');

    return qb.getMany();
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException(`Producto ${id} no encontrado`);
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    await this.ensureUniqueSku(dto.sku);
    const category = dto.categoryId ? await this.categories.findOne(dto.categoryId) : null;
    const initialStock = dto.initialStock ?? 0;

    const id = await this.dataSource.transaction(async (em) => {
      const product = await em.save(
        em.create(Product, {
          sku: dto.sku.trim(),
          name: dto.name.trim(),
          description: dto.description ?? null,
          price: dto.price,
          minStock: dto.minStock ?? 0,
          stock: initialStock,
          category,
        }),
      );
      if (initialStock > 0) {
        await em.save(
          em.create(StockMovement, {
            product,
            type: MovementType.IN,
            quantity: initialStock,
            previousStock: 0,
            newStock: initialStock,
            reason: 'Stock inicial',
          }),
        );
      }
      return product.id;
    });
    return this.findOne(id);
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.sku && dto.sku !== product.sku) await this.ensureUniqueSku(dto.sku);
    if (dto.categoryId !== undefined) {
      product.category = dto.categoryId ? await this.categories.findOne(dto.categoryId) : null;
    }
    const { categoryId: _ignored, ...fields } = dto;
    Object.assign(product, fields);
    await this.products.save(product);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    await this.dataSource.transaction(async (em) => {
      await em
        .createQueryBuilder()
        .delete()
        .from(StockMovement)
        .where('productId = :id', { id })
        .execute();
      await em.remove(product);
    });
  }

  async summary(): Promise<InventorySummary> {
    const totals = await this.products
      .createQueryBuilder('p')
      .select('COUNT(p.id)', 'totalProducts')
      .addSelect('COALESCE(SUM(p.stock), 0)', 'totalUnits')
      .addSelect('COALESCE(SUM(p.stock * p.price), 0)', 'inventoryValue')
      .getRawOne<{ totalProducts: number; totalUnits: number; inventoryValue: number }>();
    const lowStock = await this.findAll({ lowStock: true });
    return {
      totalProducts: Number(totals?.totalProducts ?? 0),
      totalUnits: Number(totals?.totalUnits ?? 0),
      inventoryValue: Math.round(Number(totals?.inventoryValue ?? 0) * 100) / 100,
      lowStockCount: lowStock.length,
      lowStock,
    };
  }

  private async ensureUniqueSku(sku: string) {
    if (await this.products.existsBy({ sku: sku.trim() })) {
      throw new ConflictException(`Ya existe un producto con SKU "${sku}"`);
    }
  }
}
