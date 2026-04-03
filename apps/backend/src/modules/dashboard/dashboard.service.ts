import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentMethod, TableStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateExchangeRatesDto } from './dto/update-exchange-rates.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async basicStats(filters?: { from?: string; to?: string }) {
    const settings = await this.getSettings();

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

    const fallbackStart = new Date(new Date().setHours(0, 0, 0, 0));
    const fromDate = filters?.from ? parseLocalDate(filters.from, false) : fallbackStart;
    const toDate = filters?.to ? parseLocalDate(filters.to, true) : new Date();

    const startDate = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : fallbackStart;
    const endDate = toDate && !Number.isNaN(toDate.getTime()) ? toDate : new Date();

    const paidAtWhere = {
      gte: startDate,
      lte: endDate,
    };

    const [tablesFree, tablesOccupied, activeOrders, todayPayments] = await Promise.all([
      this.prisma.table.count({ where: { status: TableStatus.FREE } }),
      this.prisma.table.count({ where: { status: TableStatus.OCCUPIED } }),
      this.prisma.order.count({
        where: { status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY] } },
      }),
      this.prisma.payment.findMany({
        where: { paidAt: paidAtWhere },
      }),
    ]);

    const revenueToday = todayPayments.reduce((sum, p) => sum + Number(p.total), 0);

    const resolveLegacyPaidAmount = (method: PaymentMethod, totalCop: number) => {
      switch (method) {
        case PaymentMethod.BOLIVARES:
        case PaymentMethod.POS:
        case PaymentMethod.MOBILE_PAYMENT:
          return totalCop / Number(settings.copToBsDivisor);
        case PaymentMethod.USD:
        case PaymentMethod.ZELLE:
          return totalCop / Number(settings.copToUsdDivisor);
        default:
          return totalCop;
      }
    };

    const paymentsByMethod = Object.values(PaymentMethod).map((method) => {
      const payments = todayPayments.filter((payment) => payment.method === method);

      const total = payments.reduce((sum, payment) => {
        const paidAmount = payment.paidAmount ? Number(payment.paidAmount) : null;
        if (paidAmount !== null && Number.isFinite(paidAmount)) {
          return sum + paidAmount;
        }

        return sum + resolveLegacyPaidAmount(payment.method, Number(payment.total));
      }, 0);

      return {
        method,
        count: payments.length,
        total,
      };
    });

    const closedOrders = await this.prisma.order.findMany({
      where: { closedAt: { gte: startDate, lte: endDate } },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const productSummaryMap = new Map<string, {
      productId: string;
      productName: string;
      categoryName: string;
      isPackaging: boolean;
      isBeverage: boolean;
      quantity: number;
      unitPrice: number;
      totalCop: number;
    }>();

    for (const order of closedOrders) {
      for (const item of order.items) {
        const key = item.productId;
        const categoryName = item.product.category?.name || 'Sin categoria';
        const isPackaging = Boolean(item.product.category?.isPackaging);
        const isBeverage = /bebida|refresco|jugo/i.test(categoryName);
        const current = productSummaryMap.get(key) || {
          productId: item.productId,
          productName: item.product.name,
          categoryName,
          isPackaging,
          isBeverage,
          quantity: 0,
          unitPrice: Number(item.unitPrice),
          totalCop: 0,
        };

        current.quantity += item.quantity;
        current.totalCop += Number(item.unitPrice) * item.quantity;
        productSummaryMap.set(key, current);
      }
    }

    const salesReport = Array.from(productSummaryMap.values())
      .map((item) => ({
        ...item,
        totalBs: Number((item.totalCop / Number(settings.copToBsDivisor)).toFixed(2)),
        totalUsd: Number((item.totalCop / Number(settings.copToUsdDivisor)).toFixed(2)),
      }))
      .sort((a, b) => {
        const weightA = a.isPackaging ? 2 : a.isBeverage ? 1 : 0;
        const weightB = b.isPackaging ? 2 : b.isBeverage ? 1 : 0;
        if (weightA !== weightB) {
          return weightA - weightB;
        }
        return a.productName.localeCompare(b.productName);
      });

    return {
      tablesFree,
      tablesOccupied,
      activeOrders,
      revenueToday,
      revenuePeriod: revenueToday,
      ticketsToday: todayPayments.length,
      ticketsPeriod: todayPayments.length,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      exchangeRates: {
        copToBsDivisor: Number(settings.copToBsDivisor),
        copToUsdDivisor: Number(settings.copToUsdDivisor),
      },
      paymentsByMethod,
      salesReport,
    };
  }

  async updateExchangeRates(dto: UpdateExchangeRatesDto) {
    return this.prisma.dashboardSettings.upsert({
      where: { id: 'default' },
      update: {
        copToBsDivisor: dto.copToBsDivisor,
        copToUsdDivisor: dto.copToUsdDivisor,
      },
      create: {
        id: 'default',
        copToBsDivisor: dto.copToBsDivisor,
        copToUsdDivisor: dto.copToUsdDivisor,
      },
    });
  }

  private getSettings() {
    return this.prisma.dashboardSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        copToBsDivisor: 5.5,
        copToUsdDivisor: 3600,
      },
    });
  }
}
