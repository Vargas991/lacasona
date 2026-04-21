import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CashMovementType,
  CashSessionStatus,
  PaymentCurrency,
  PaymentMethod,
  Prisma,
  TableStatus,
} from '@prisma/client';
import { EventsService } from '../events/events.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { TablesService } from '../tables/tables.service';
import { CalculateChangeDto } from './dto/calculate-change.dto';
import { CloseAccountDto } from './dto/close-account.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

type DashboardSettingsSnapshot = {
  copToBsDivisor: number;
  copToUsdDivisor: number;
};

type SessionBalanceMap = Record<PaymentCurrency, number>;

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly tablesService: TablesService,
    private readonly events: EventsService,
  ) {}

  async previewTableAccount(tableId: string) {
    const settings = await this.getSettings();

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
        bs: this.convertCopToCurrency(total, PaymentCurrency.BS, settings),
        usd: this.convertCopToCurrency(total, PaymentCurrency.USD, settings),
      },
      exchangeRates: settings,
    };
  }

  async openCashSession(dto: OpenCashSessionDto) {
    const existing = await this.prisma.cashSession.findFirst({
      where: {
        cashierId: dto.cashierId,
        status: CashSessionStatus.OPEN,
      },
    });

    if (existing) {
      throw new BadRequestException('Cashier already has an open cash session');
    }

    const settings = await this.getSettings();

    const session = await this.prisma.cashSession.create({
      data: {
        cashierId: dto.cashierId,
        openingCurrency: dto.openingCurrency,
        openingAmount: dto.openingAmount,
        openingCopToBsDivisor: settings.copToBsDivisor,
        openingCopToUsdDivisor: settings.copToUsdDivisor,
        openingNote: dto.openingNote,
        movements: {
          create: {
            createdById: dto.cashierId,
            type: CashMovementType.OPENING,
            currency: dto.openingCurrency,
            amount: dto.openingAmount,
            copToBsDivisorSnapshot: settings.copToBsDivisor,
            copToUsdDivisorSnapshot: settings.copToUsdDivisor,
            note: dto.openingNote || 'Apertura de caja',
          },
        },
      },
      include: {
        movements: true,
      },
    });

    this.events.publish('cash.session.opened', {
      sessionId: session.id,
      cashierId: session.cashierId,
      openedAt: session.openedAt,
    });

    return this.buildSessionSummary(session, session.movements, []);
  }

  async getActiveCashSession(cashierId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: {
        cashierId,
        status: CashSessionStatus.OPEN,
      },
      orderBy: { openedAt: 'desc' },
      include: {
        movements: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paidAt: 'asc' } },
      },
    });

    if (!session) {
      return null;
    }

    return this.buildSessionSummary(session, session.movements, session.payments);
  }

  async getCashSession(sessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paidAt: 'asc' } },
      },
    });

    if (!session) {
      throw new NotFoundException('Cash session not found');
    }

    return this.buildSessionSummary(session, session.movements, session.payments);
  }

  async listCashSessionMovements(sessionId: string) {
    await this.ensureCashSessionExists(sessionId);

    return this.prisma.cashMovement.findMany({
      where: { cashSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCashMovement(sessionId: string, dto: CreateCashMovementDto) {
    const session = await this.ensureOpenCashSession(sessionId);
    const settings = await this.getSettings();

    const movement = await this.prisma.cashMovement.create({
      data: {
        cashSessionId: session.id,
        createdById: dto.createdById,
        tableId: dto.tableId,
        orderId: dto.orderId,
        paymentId: dto.paymentId,
        type: dto.type,
        currency: dto.currency,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        relatedCurrency: dto.relatedCurrency,
        relatedAmount: dto.relatedAmount,
        copToBsDivisorSnapshot: settings.copToBsDivisor,
        copToUsdDivisorSnapshot: settings.copToUsdDivisor,
        note: dto.note,
      },
    });

    this.events.publish('cash.movement.created', {
      sessionId: session.id,
      movementId: movement.id,
      type: movement.type,
    });

    return movement;
  }

  async calculateChange(dto: CalculateChangeDto) {
    const settings = await this.getSettings();
    const changeCurrency = dto.changeCurrency || dto.tenderedCurrency;

    const totalCop = this.convertCurrencyToCop(dto.totalAmount, dto.totalCurrency, settings);
    const tenderedCop = this.convertCurrencyToCop(
      dto.tenderedAmount,
      dto.tenderedCurrency,
      settings,
    );

    if (tenderedCop + 0.0001 < totalCop) {
      throw new BadRequestException('Tendered amount is lower than the total due');
    }

    const changeCop = this.roundMoney(tenderedCop - totalCop);
    const changeInTenderedCurrency = this.convertCopToCurrency(
      changeCop,
      dto.tenderedCurrency,
      settings,
    );
    const changeInSelectedCurrency = this.convertCopToCurrency(
      changeCop,
      changeCurrency,
      settings,
    );

    return {
      total: {
        amount: dto.totalAmount,
        currency: dto.totalCurrency,
        copEquivalent: totalCop,
      },
      tendered: {
        amount: dto.tenderedAmount,
        currency: dto.tenderedCurrency,
        copEquivalent: tenderedCop,
      },
      change: {
        copEquivalent: changeCop,
        dueInTenderedCurrency: {
          amount: changeInTenderedCurrency,
          currency: dto.tenderedCurrency,
        },
        deliverInCurrency: {
          amount: changeInSelectedCurrency,
          currency: changeCurrency,
        },
      },
      exchangeRates: settings,
    };
  }

  async closeTableAccount(dto: CloseAccountDto) {
    const settings = await this.getSettings();
    const activeSession = await this.prisma.cashSession.findFirst({
      where: {
        cashierId: dto.cashierId,
        status: CashSessionStatus.OPEN,
      },
    });

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

    const totalDueCop = perOrderTotals.reduce((sum, item) => sum + item.total, 0);
    const settlementCurrency = this.resolveSettlementCurrency(dto.method);
    const tenderedCurrency = dto.tenderedCurrency || settlementCurrency;
    const tenderedAmount =
      dto.tenderedAmount ??
      this.convertCopToCurrency(totalDueCop, tenderedCurrency, settings);
    const changeCurrency = dto.changeCurrency || tenderedCurrency;
    const registerInCashSession = dto.registerInCashSession ?? true;

    const changeQuote = await this.calculateChange({
      totalAmount: this.convertCopToCurrency(totalDueCop, tenderedCurrency, settings),
      totalCurrency: tenderedCurrency,
      tenderedAmount,
      tenderedCurrency,
      changeCurrency,
    });

    const resolvePaidSnapshot = (method: PaymentMethod, totalCop: number) => {
      switch (method) {
        case PaymentMethod.BOLIVARES:
        case PaymentMethod.POS:
        case PaymentMethod.MOBILE_PAYMENT:
          return {
            paidCurrency: PaymentCurrency.BS,
            paidAmount: this.convertCopToCurrency(totalCop, PaymentCurrency.BS, settings),
          };
        case PaymentMethod.USD:
        case PaymentMethod.ZELLE:
          return {
            paidCurrency: PaymentCurrency.USD,
            paidAmount: this.convertCopToCurrency(totalCop, PaymentCurrency.USD, settings),
          };
        default:
          return {
            paidCurrency: PaymentCurrency.COP,
            paidAmount: this.roundMoney(totalCop),
          };
      }
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const createdPayments = await Promise.all(
        perOrderTotals.map((item) => {
          const snapshot = resolvePaidSnapshot(dto.method, item.total);

          return tx.payment.create({
            data: {
              orderId: item.orderId,
              cashierId: dto.cashierId,
              cashSessionId: activeSession?.id,
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

      if (activeSession && registerInCashSession) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: activeSession.id,
            createdById: dto.cashierId,
            tableId: dto.tableId,
            type: CashMovementType.SALE_TENDERED,
            currency: tenderedCurrency,
            amount: tenderedAmount,
            paymentMethod: dto.method,
            relatedCurrency: PaymentCurrency.COP,
            relatedAmount: totalDueCop,
            copToBsDivisorSnapshot: settings.copToBsDivisor,
            copToUsdDivisorSnapshot: settings.copToUsdDivisor,
            note: dto.note || 'Cobro de cuenta',
          },
        });

        if (changeQuote.change.copEquivalent > 0) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: activeSession.id,
              createdById: dto.cashierId,
              tableId: dto.tableId,
              type: CashMovementType.CHANGE_GIVEN,
              currency: changeCurrency,
              amount: changeQuote.change.deliverInCurrency.amount,
              paymentMethod: dto.method,
              relatedCurrency: tenderedCurrency,
              relatedAmount: changeQuote.change.dueInTenderedCurrency.amount,
              copToBsDivisorSnapshot: settings.copToBsDivisor,
              copToUsdDivisorSnapshot: settings.copToUsdDivisor,
              note: dto.note || 'Vuelto entregado',
            },
          });
        }
      }

      return { createdPayments };
    });

    await this.ordersService.closeOrders(perOrderTotals.map((item) => item.orderId));
    await this.tablesService.markFree(dto.tableId);

    const summary = {
      tableId: dto.tableId,
      orderIds: perOrderTotals.map((item) => item.orderId),
      subtotal: perOrderTotals.reduce((sum, item) => sum + item.subtotal, 0),
      tax: perOrderTotals.reduce((sum, item) => sum + item.tax, 0),
      total: totalDueCop,
    };

    const payload = {
      tableId: dto.tableId,
      payment: result.createdPayments[result.createdPayments.length - 1],
      paymentsCount: result.createdPayments.length,
      totals: summary,
      settlement: {
        method: dto.method,
        tenderedAmount,
        tenderedCurrency,
        changeCurrency,
        registerInCashSession,
        changeAmount: changeQuote.change.deliverInCurrency.amount,
        changeCopEquivalent: changeQuote.change.copEquivalent,
      },
      cashSessionId: activeSession?.id || null,
    };

    this.events.publish('cash.closed', payload);
    return payload;
  }

  async closeCashSession(sessionId: string, dto: CloseCashSessionDto) {
    const session = await this.ensureOpenCashSession(sessionId);
    const summary = await this.getCashSession(sessionId);

    const counted: SessionBalanceMap = {
      COP: dto.countedCop ?? summary.expectedBalances.COP,
      BS: dto.countedBs ?? summary.expectedBalances.BS,
      USD: dto.countedUsd ?? summary.expectedBalances.USD,
    };

    const differences: SessionBalanceMap = {
      COP: this.roundMoney(counted.COP - summary.expectedBalances.COP),
      BS: this.roundMoney(counted.BS - summary.expectedBalances.BS),
      USD: this.roundMoney(counted.USD - summary.expectedBalances.USD),
    };

    const closed = await this.prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedById: dto.closedById,
        closedAt: new Date(),
        closingNote: dto.closingNote,
        expectedCopAtClose: summary.expectedBalances.COP,
        expectedBsAtClose: summary.expectedBalances.BS,
        expectedUsdAtClose: summary.expectedBalances.USD,
        countedCop: counted.COP,
        countedBs: counted.BS,
        countedUsd: counted.USD,
        differenceCop: differences.COP,
        differenceBs: differences.BS,
        differenceUsd: differences.USD,
      },
    });

    const payload = {
      sessionId: closed.id,
      closedAt: closed.closedAt,
      expectedBalances: summary.expectedBalances,
      countedBalances: counted,
      differences,
      sales: summary.salesByCurrency,
      movementTotals: summary.movementTotals,
    };

    this.events.publish('cash.session.closed', payload);
    return payload;
  }

  private async ensureCashSessionExists(sessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Cash session not found');
    }

    return session;
  }

  private async ensureOpenCashSession(sessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Cash session not found');
    }

    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('Cash session is already closed');
    }

    return session;
  }

  private async getSettings(): Promise<DashboardSettingsSnapshot> {
    const settings = await this.prisma.dashboardSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        copToBsDivisor: 5.5,
        copToUsdDivisor: 3600,
      },
    });

    return {
      copToBsDivisor: Number(settings.copToBsDivisor),
      copToUsdDivisor: Number(settings.copToUsdDivisor),
    };
  }

  private resolveSettlementCurrency(method: PaymentMethod): PaymentCurrency {
    switch (method) {
      case PaymentMethod.BOLIVARES:
      case PaymentMethod.POS:
      case PaymentMethod.MOBILE_PAYMENT:
        return PaymentCurrency.BS;
      case PaymentMethod.USD:
      case PaymentMethod.ZELLE:
        return PaymentCurrency.USD;
      default:
        return PaymentCurrency.COP;
    }
  }

  private convertCurrencyToCop(
    amount: number,
    currency: PaymentCurrency,
    settings: DashboardSettingsSnapshot,
  ) {
    switch (currency) {
      case PaymentCurrency.BS:
        return this.roundMoney(amount * settings.copToBsDivisor);
      case PaymentCurrency.USD:
        return this.roundMoney(amount * settings.copToUsdDivisor);
      default:
        return this.roundMoney(amount);
    }
  }

  private convertCopToCurrency(
    amountCop: number,
    currency: PaymentCurrency,
    settings: DashboardSettingsSnapshot,
  ) {
    switch (currency) {
      case PaymentCurrency.BS:
        return this.roundMoney(amountCop / settings.copToBsDivisor);
      case PaymentCurrency.USD:
        return this.roundMoney(amountCop / settings.copToUsdDivisor);
      default:
        return this.roundMoney(amountCop);
    }
  }

  private roundMoney(value: number) {
    return Number(value.toFixed(2));
  }

  private movementDirection(type: CashMovementType) {
    switch (type) {
      case CashMovementType.CHANGE_GIVEN:
      case CashMovementType.EXCHANGE_OUT:
      case CashMovementType.EXPENSE:
        return -1;
      default:
        return 1;
    }
  }

  private buildSessionSummary(
    session: {
      id: string;
      cashierId: string;
      status: CashSessionStatus;
      openingCurrency: PaymentCurrency;
      openingAmount: Prisma.Decimal | number;
      openingNote: string | null;
      openedAt: Date;
      closedAt: Date | null;
      closingNote: string | null;
      countedCop: Prisma.Decimal | number | null;
      countedBs: Prisma.Decimal | number | null;
      countedUsd: Prisma.Decimal | number | null;
      differenceCop: Prisma.Decimal | number | null;
      differenceBs: Prisma.Decimal | number | null;
      differenceUsd: Prisma.Decimal | number | null;
    },
    movements: Array<{
      type: CashMovementType;
      currency: PaymentCurrency;
      amount: Prisma.Decimal | number;
      paymentMethod: PaymentMethod | null;
      relatedCurrency: PaymentCurrency | null;
      relatedAmount: Prisma.Decimal | number | null;
      note: string | null;
      createdAt: Date;
    }>,
    payments: Array<{
      method: PaymentMethod;
      total: Prisma.Decimal | number;
      paidCurrency: PaymentCurrency;
      paidAmount: Prisma.Decimal | number | null;
    }>,
  ) {
    const expectedBalances: SessionBalanceMap = { COP: 0, BS: 0, USD: 0 };
    const movementTotals = {
      inflows: { COP: 0, BS: 0, USD: 0 } as SessionBalanceMap,
      outflows: { COP: 0, BS: 0, USD: 0 } as SessionBalanceMap,
      byType: {} as Record<string, number>,
    };

    for (const movement of movements) {
      const amount = Number(movement.amount);
      const direction = this.movementDirection(movement.type);
      expectedBalances[movement.currency] = this.roundMoney(
        expectedBalances[movement.currency] + amount * direction,
      );

      if (direction > 0) {
        movementTotals.inflows[movement.currency] = this.roundMoney(
          movementTotals.inflows[movement.currency] + amount,
        );
      } else {
        movementTotals.outflows[movement.currency] = this.roundMoney(
          movementTotals.outflows[movement.currency] + amount,
        );
      }

      movementTotals.byType[movement.type] = this.roundMoney(
        (movementTotals.byType[movement.type] || 0) + amount,
      );
    }

    const salesByCurrency = payments.reduce<
      Record<PaymentCurrency, { count: number; total: number }>
    >(
      (acc, payment) => {
        const amount = payment.paidAmount !== null ? Number(payment.paidAmount) : Number(payment.total);
        acc[payment.paidCurrency].count += 1;
        acc[payment.paidCurrency].total = this.roundMoney(acc[payment.paidCurrency].total + amount);
        return acc;
      },
      {
        COP: { count: 0, total: 0 },
        BS: { count: 0, total: 0 },
        USD: { count: 0, total: 0 },
      },
    );

    return {
      session: {
        id: session.id,
        cashierId: session.cashierId,
        status: session.status,
        openingCurrency: session.openingCurrency,
        openingAmount: Number(session.openingAmount),
        openingNote: session.openingNote,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        closingNote: session.closingNote,
      },
      expectedBalances,
      countedBalances: {
        COP: session.countedCop === null ? null : Number(session.countedCop),
        BS: session.countedBs === null ? null : Number(session.countedBs),
        USD: session.countedUsd === null ? null : Number(session.countedUsd),
      },
      differences: {
        COP: session.differenceCop === null ? null : Number(session.differenceCop),
        BS: session.differenceBs === null ? null : Number(session.differenceBs),
        USD: session.differenceUsd === null ? null : Number(session.differenceUsd),
      },
      salesByCurrency,
      movementTotals,
      movements: movements.map((movement) => ({
        ...movement,
        amount: Number(movement.amount),
        relatedAmount:
          movement.relatedAmount === null ? null : Number(movement.relatedAmount),
      })),
      paymentsCount: payments.length,
    };
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
