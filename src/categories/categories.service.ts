import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';
import { Category } from './category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async findAll() {
    const rows = await this.categories
      .createQueryBuilder('c')
      .loadRelationCountAndMap('c.productCount', 'c.products')
      .orderBy('c.name', 'ASC')
      .getMany();
    return rows;
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException(`Categoría ${id} no encontrada`);
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.ensureUniqueName(dto.name);
    return this.categories.save(this.categories.create({ ...dto, description: dto.description ?? null }));
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    if (dto.name && dto.name !== category.name) await this.ensureUniqueName(dto.name);
    Object.assign(category, dto);
    return this.categories.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    const count = await this.products.count({ where: { category: { id } } });
    if (count > 0) {
      throw new ConflictException(
        `No se puede eliminar: la categoría tiene ${count} producto(s) asociado(s)`,
      );
    }
    await this.categories.remove(category);
  }

  private async ensureUniqueName(name: string) {
    if (await this.categories.existsBy({ name })) {
      throw new ConflictException(`Ya existe una categoría llamada "${name}"`);
    }
  }
}
