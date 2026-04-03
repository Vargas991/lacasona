import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async listAll() {
    return this.prisma.product.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateProductDto) {
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        categoryId: dto.categoryId || null,
      },
    });
  }

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(dto: CreateCategoryDto) {
    const exists = await this.prisma.category.findUnique({ where: { name: dto.name } });
    if (exists) {
      throw new BadRequestException('Category already exists');
    }

    if (dto.isPackaging) {
      await this.prisma.category.updateMany({ data: { isPackaging: false } });
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        isPackaging: Boolean(dto.isPackaging),
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name && dto.name !== category.name) {
      const exists = await this.prisma.category.findUnique({ where: { name: dto.name } });
      if (exists) {
        throw new BadRequestException('Category already exists');
      }
    }

    if (dto.isPackaging === true) {
      await this.prisma.category.updateMany({
        where: { id: { not: id } },
        data: { isPackaging: false },
      });
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        isPackaging: dto.isPackaging,
      },
    });
  }

  async removeCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }

    const normalizedCategoryId =
      dto.categoryId !== undefined ? dto.categoryId || null : undefined;

    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        categoryId: normalizedCategoryId,
      },
    });
  }

  async deactivate(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return { deleted: true };
  }

  async setStatus(id: string, isActive: boolean) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive },
      include: { category: true },
    });
  }
}
