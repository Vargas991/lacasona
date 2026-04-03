import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma, TableStatus } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { TablesService } from '../tables/tables.service';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { SwapTablesDto } from './dto/swap-tables.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tablesService: TablesService,
    private readonly events: EventsService,
  ) {}

  async create(dto: CreateOrderDto) {
    if (!dto.items.length) {
      throw new BadRequestException('Order needs at least one item');
    }

    const table = await this.prisma.table.findUnique({ where: { id: dto.tableId } });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    if (table.status === TableStatus.DISABLED) {
      throw new BadRequestException('Cannot create order on a disabled table');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) }, isActive: true },
    });

    if (products.length !== dto.items.length) {
      throw new BadRequestException('One or more products are invalid');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    const dateKey = this.getCurrentDateKey();

    const order = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.dailyCounter.upsert({
        where: { dateKey },
        update: { lastOrderNumber: { increment: 1 } },
        create: { dateKey, lastOrderNumber: 1 },
      });

      return tx.order.create({
        data: {
          tableId: dto.tableId,
          waiterId: dto.waiterId,
          dateKey,
          dailySequence: counter.lastOrderNumber,
          status: OrderStatus.PENDING,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              note: item.note,
              unitPrice: productMap.get(item.productId)!.price,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          table: true,
        },
      });
    });

    await this.tablesService.markBusy(dto.tableId);
    this.events.publish('order.created', order);
    return order;
  }

  listActive() {
    return this.prisma.order.findMany({
      where: { status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY] } },
      include: { items: { include: { product: true } }, table: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listHistory(filters: {
    from?: string;
    to?: string;
    tableId?: string;
    status?: string;
    paymentMethod?: PaymentMethod;
    paymentGroup?: string;
    limit?: number;
  }) {
    const where: Prisma.OrderWhereInput = {};

    if (filters.tableId) {
      where.tableId = filters.tableId;
    }

    if (filters.status) {
      if (!Object.values(OrderStatus).includes(filters.status as OrderStatus)) {
        throw new BadRequestException('Invalid order status filter');
      }
      where.status = filters.status as OrderStatus;
    }

    if (filters.paymentMethod) {
      if (!Object.values(PaymentMethod).includes(filters.paymentMethod)) {
        throw new BadRequestException('Invalid payment method filter');
      }
      where.payment = { is: { method: filters.paymentMethod } };
    }

    if (filters.paymentGroup) {
      const groupMap: Record<string, PaymentMethod[]> = {
        COP: [PaymentMethod.CASH, PaymentMethod.CASH_COP],
        BS: [PaymentMethod.BOLIVARES, PaymentMethod.POS, PaymentMethod.MOBILE_PAYMENT],
        USD: [PaymentMethod.USD],
        ZELLE: [PaymentMethod.ZELLE],
        CARD: [PaymentMethod.CARD],
      };

      const methods = groupMap[filters.paymentGroup];
      if (!methods) {
        throw new BadRequestException('Invalid payment group filter');
      }

      where.payment = { is: { method: { in: methods } } };
    }

    const parseLocalDate = (value: string, endOfDay = false) => {
      const parts = value.split('-').map(Number);
      if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
        return null;
      }

      const [year, month, day] = parts;
      if (endOfDay) {
        return new Date(year, month - 1, day, 23, 59, 59, 999);
      }
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    };

    const createdAt: { gte?: Date; lte?: Date } = {};
    if (filters.from) {
      const fromDate = parseLocalDate(filters.from, false);
      if (!fromDate || Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException('Invalid from date filter');
      }
      createdAt.gte = fromDate;
    }

    if (filters.to) {
      const toDate = parseLocalDate(filters.to, true);
      if (!toDate || Number.isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid to date filter');
      }
      createdAt.lte = toDate;
    }

    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const take = Math.min(Math.max(filters.limit || 100, 1), 500);

    return this.prisma.order.findMany({
      where,
      include: {
        table: true,
        waiter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async setStatus(id: string, dto: ChangeOrderStatusDto) {
    await this.ensureExists(id);
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: { items: { include: { product: true } }, table: true },
    });

    this.events.publish('order.status.changed', order);
    return order;
  }

  async getBillingSummaryByTable(tableId: string) {
    const lastPayment = await this.prisma.payment.findFirst({
      where: {
        order: {
          tableId,
        },
      },
      orderBy: { paidAt: 'desc' },
      select: { paidAt: true },
    });

    const where: Prisma.OrderWhereInput = {
      tableId,
      payment: null,
    };

    if (lastPayment?.paidAt) {
      where.createdAt = { gt: lastPayment.paidAt };
    }

    const openOrders = await this.prisma.order.findMany({
      where,
      include: { items: true },
    });

    if (!openOrders.length) {
      throw new NotFoundException('No open orders for table');
    }

    const subtotal = openOrders.reduce((sum, order) => {
      const orderTotal = order.items.reduce(
        (acc, item) => acc + Number(item.unitPrice) * item.quantity,
        0,
      );
      return sum + orderTotal;
    }, 0);

    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    return {
      tableId,
      orderIds: openOrders.map((o) => o.id),
      subtotal,
      tax,
      total,
    };
  }

  async closeOrders(orderIds: string[]) {
    await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: OrderStatus.DELIVERED, closedAt: new Date() },
    });
  }

  async swapTables(dto: SwapTablesDto) {
    if (dto.fromTableId === dto.toTableId) {
      throw new BadRequestException('Cannot swap the same table');
    }

    const [fromTable, toTable] = await Promise.all([
      this.prisma.table.findUnique({ where: { id: dto.fromTableId } }),
      this.prisma.table.findUnique({ where: { id: dto.toTableId } }),
    ]);

    if (!fromTable || !toTable) {
      throw new NotFoundException('One or both tables not found');
    }

    if (toTable.status === TableStatus.DISABLED) {
      throw new BadRequestException('Cannot move orders to a disabled table');
    }

    const activeWhere = {
      status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY] as OrderStatus[] },
    };

    const [fromOrders, toOrders] = await Promise.all([
      this.prisma.order.findMany({ where: { tableId: dto.fromTableId, ...activeWhere } }),
      this.prisma.order.findMany({ where: { tableId: dto.toTableId, ...activeWhere } }),
    ]);

    if (!fromOrders.length && !toOrders.length) {
      throw new BadRequestException('No active orders to swap');
    }

    await this.prisma.$transaction(async (tx) => {
      if (fromOrders.length) {
        await tx.order.updateMany({
          where: { id: { in: fromOrders.map((o) => o.id) } },
          data: { tableId: dto.toTableId },
        });
      }

      if (toOrders.length) {
        await tx.order.updateMany({
          where: { id: { in: toOrders.map((o) => o.id) } },
          data: { tableId: dto.fromTableId },
        });
      }

      await tx.table.update({
        where: { id: dto.fromTableId },
        data: { status: toOrders.length ? TableStatus.OCCUPIED : TableStatus.FREE },
      });

      await tx.table.update({
        where: { id: dto.toTableId },
        data: { status: fromOrders.length ? TableStatus.OCCUPIED : TableStatus.FREE },
      });
    });

    const [updatedFrom, updatedTo] = await Promise.all([
      this.prisma.table.findUnique({ where: { id: dto.fromTableId } }),
      this.prisma.table.findUnique({ where: { id: dto.toTableId } }),
    ]);

    this.events.publish('order.tables.swapped', {
      fromTableId: dto.fromTableId,
      toTableId: dto.toTableId,
      fromOrders: fromOrders.length,
      toOrders: toOrders.length,
    });

    this.events.publish('table.status.changed', updatedFrom);
    this.events.publish('table.status.changed', updatedTo);

    return {
      success: true,
      movedFromTo: fromOrders.length,
      movedToFrom: toOrders.length,
    };
  }

  private async ensureExists(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
  }

  private getCurrentDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}
