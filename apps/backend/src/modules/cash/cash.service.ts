import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentCurrency, PaymentMethod, Prisma, TableStatus } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { TablesService } from '../tables/tables.service';
import { CloseAccountDto } from './dto/close-account.dto';

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly tablesService: TablesService,
    private readonly events: EventsService,
  ) {}

  async previewTableAccount(tableId: string) {
    const settings = await this.prisma.dashboardSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        copToBsDivisor: 5.5,
        copToUsdDivisor: 3600,
      },
    });

    const table = await this.prisma.table.findUnique({ where: { id: tableId } });
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const ordersWhere = await this.getCurrentTableUnpaidWhere(tableId);

    const openOrders = await this.prisma.order.findMany({
      where: ordersWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        isDelivery: true,
        deliveryAddress: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            note: true,
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                isActive: true,
                categoryId: true,
              },
            },
          },
        },
      },
    });

    if (!openOrders.length) {
      throw new NotFoundException('No open orders for table');
    }

    const detailItems = openOrders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.unitPrice) * item.quantity,
        note: item.note,
      })),
    );

    const subtotal = detailItems.reduce((sum, item) => sum + item.lineTotal, 0);
    // const tax = subtotal * 0.16;
    // const tax = subtotal * 0.16;
    const tax = 0;
    const total = subtotal + tax;

    return {
      table: {
        id: table.id,
        name: table.name,
      },
      orders: openOrders.map((order) => ({
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        isDelivery: order.isDelivery,
        deliveryAddress: order.deliveryAddress,
      })),
      items: detailItems,
      subtotal,
      tax,
      total,
      conversions: {
        cop: total,
        bs: total / Number(settings.copToBsDivisor),
        usd: total / Number(settings.copToUsdDivisor),
      },
      exchangeRates: {
        copToBsDivisor: Number(settings.copToBsDivisor),
        copToUsdDivisor: Number(settings.copToUsdDivisor),
      },
    };
  }

  async closeTableAccount(dto: CloseAccountDto) {
    const settings = await this.prisma.dashboardSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        copToBsDivisor: 5.5,
        copToUsdDivisor: 3600,
      },
    });

    const copToBsDivisor = Number(settings.copToBsDivisor);
    const copToUsdDivisor = Number(settings.copToUsdDivisor);

    await this.prisma.table.update({
      where: { id: dto.tableId },
      data: { status: TableStatus.BILLING },
    });

    const ordersWhere = await this.getCurrentTableUnpaidWhere(dto.tableId);

    const openOrders = await this.prisma.order.findMany({
      where: ordersWhere,
      include: { items: true },
    });

    if (!openOrders.length) {
      throw new NotFoundException('No open orders for table');
    }

    const perOrderTotals = openOrders.map((order) => {
      const subtotal = order.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );
      const tax = 0;
      const total = subtotal + tax;

      return {
        orderId: order.id,
        subtotal,
        tax,
        total,
      };
    });

    const resolvePaidSnapshot = (method: PaymentMethod, totalCop: number) => {
      switch (method) {
        case PaymentMethod.BOLIVARES:
        case PaymentMethod.POS:
        case PaymentMethod.MOBILE_PAYMENT:
          return {
            paidCurrency: PaymentCurrency.BS,
            paidAmount: totalCop / copToBsDivisor,
          };
        case PaymentMethod.USD:
        case PaymentMethod.ZELLE:
          return {
            paidCurrency: PaymentCurrency.USD,
            paidAmount: totalCop / copToUsdDivisor,
          };
        default:
          return {
            paidCurrency: PaymentCurrency.COP,
            paidAmount: totalCop,
          };
      }
    };

    const createdPayments = await this.prisma.$transaction(
      perOrderTotals.map((item) => {
        const snapshot = resolvePaidSnapshot(dto.method, item.total);

        return this.prisma.payment.create({
          data: {
            orderId: item.orderId,
            cashierId: dto.cashierId,
            method: dto.method,
            subtotal: item.subtotal,
            tax: item.tax,
            total: item.total,
            paidCurrency: snapshot.paidCurrency,
            paidAmount: snapshot.paidAmount,
            copToBsDivisorSnapshot: settings.copToBsDivisor,
            copToUsdDivisorSnapshot: settings.copToUsdDivisor,
          },
        });
      }),
    );

    await this.ordersService.closeOrders(perOrderTotals.map((item) => item.orderId));
    await this.tablesService.markFree(dto.tableId);

    const summary = {
      tableId: dto.tableId,
      orderIds: perOrderTotals.map((item) => item.orderId),
      subtotal: perOrderTotals.reduce((sum, item) => sum + item.subtotal, 0),
      tax: perOrderTotals.reduce((sum, item) => sum + item.tax, 0),
      total: perOrderTotals.reduce((sum, item) => sum + item.total, 0),
    };

    const payload = {
      tableId: dto.tableId,
      payment: createdPayments[createdPayments.length - 1],
      paymentsCount: createdPayments.length,
      totals: summary,
    };
    this.events.publish('cash.closed', payload);
    return payload;
  }

  private async getCurrentTableUnpaidWhere(tableId: string): Promise<Prisma.OrderWhereInput> {
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

    return where;
  }
}
