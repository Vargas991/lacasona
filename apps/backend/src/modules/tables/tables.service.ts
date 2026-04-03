import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TableStatus } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeTableStatusDto } from './dto/change-table-status.dto';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async create(dto: CreateTableDto) {
    const zone = dto.zone?.trim() || 'Salon';
    const zoneCount = await this.prisma.table.count({ where: { zone } });

    const defaultX = Math.min(90, 12 + ((zoneCount % 4) * 24));
    const defaultY = Math.min(90, 12 + (Math.floor(zoneCount / 4) * 22));

    const table = await this.prisma.table.create({
      data: {
        ...dto,
        zone,
        layoutX: dto.layoutX ?? defaultX,
        layoutY: dto.layoutY ?? defaultY,
      },
    });
    this.events.publish('table.created', table);
    return table;
  }

  list() {
    return this.prisma.table.findMany({
      orderBy: [
        { zone: 'asc' },
        { layoutY: 'asc' },
        { layoutX: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async update(id: string, dto: UpdateTableDto) {
    await this.ensureExists(id);
    const table = await this.prisma.table.update({ where: { id }, data: dto });
    this.events.publish('table.updated', table);
    return table;
  }

  async remove(id: string) {
    const table = await this.ensureExists(id);

    const activeOrdersCount = await this.prisma.order.count({
      where: {
        tableId: id,
        status: { in: ['PENDING', 'PREPARING', 'READY'] },
      },
    });

    if (activeOrdersCount > 0) {
      throw new BadRequestException(
        'No se puede deshabilitar la mesa porque tiene comandas activas.',
      );
    }

    if (table.status === TableStatus.DISABLED) {
      return { deleted: false, disabled: true };
    }

    const updated = await this.prisma.table.update({
      where: { id },
      data: { status: TableStatus.DISABLED },
    });

    this.events.publish('table.status.changed', updated);
    return { deleted: false, disabled: true };
  }

  async setStatus(id: string, dto: ChangeTableStatusDto) {
    await this.ensureExists(id);

    if (dto.status === TableStatus.DISABLED) {
      const activeOrdersCount = await this.prisma.order.count({
        where: {
          tableId: id,
          status: { in: ['PENDING', 'PREPARING', 'READY'] },
        },
      });

      if (activeOrdersCount > 0) {
        throw new BadRequestException(
          'No se puede deshabilitar la mesa porque tiene comandas activas.',
        );
      }
    }

    const table = await this.prisma.table.update({
      where: { id },
      data: { status: dto.status },
    });
    this.events.publish('table.status.changed', table);
    return table;
  }

  async markBusy(tableId: string) {
    return this.prisma.table.update({
      where: { id: tableId },
      data: { status: TableStatus.OCCUPIED },
    });
  }

  async markFree(tableId: string) {
    return this.prisma.table.update({
      where: { id: tableId },
      data: { status: TableStatus.FREE },
    });
  }

  private async ensureExists(id: string) {
    const table = await this.prisma.table.findUnique({ where: { id } });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return table;
  }
}
