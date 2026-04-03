import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrintingService {
  constructor(private readonly prisma: PrismaService) {}

  async kitchenTicket(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, table: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const validationErrors: string[] = [];
    if (!order.table?.name?.trim()) {
      validationErrors.push('Table name is missing');
    }
    if (!order.items.length) {
      validationErrors.push('Order has no items to print');
    }
    if (order.items.some((item) => item.quantity <= 0)) {
      validationErrors.push('Order has items with invalid quantity');
    }
    if (order.items.some((item) => !item.product?.name?.trim())) {
      validationErrors.push('Order has items without product name');
    }

    const printable = validationErrors.length === 0;

    const lines = [
      '\x1B\x40',
      '*** COCINA ***',
      `Comanda: #${String(order.dailySequence).padStart(3, '0')}`,
      `Mesa: ${order.table.name}`,
      `Fecha: ${order.dateKey}`,
      '----------------------',
      ...order.items.map(
        (item) =>
          `${item.quantity} x ${item.product.name}${item.note ? ` | Nota: ${item.note}` : ''}`,
      ),
      '----------------------',
      '\n\n\n',
    ];

    const escpos = lines.join('\n');
    const previewLines = [
      'COCINA',
      `Comanda #${String(order.dailySequence).padStart(3, '0')}`,
      `Mesa: ${order.table.name}`,
      `Fecha: ${order.dateKey}`,
      '----------------------',
      ...order.items.map(
        (item) =>
          `${item.quantity} x ${item.product.name}${item.note ? ` | Nota: ${item.note}` : ''}`,
      ),
      '----------------------',
    ];

    return {
      orderId: order.id,
      tableName: order.table.name,
      dailySequence: order.dailySequence,
      printable,
      validationErrors,
      previewText: previewLines.join('\n'),
      escpos,
    };
  }

  async simpleInvoiceByTable(tableId: string) {
    const orders = await this.prisma.order.findMany({
      where: { tableId },
      include: { items: { include: { product: true } }, table: true },
    });

    if (!orders.length) {
      return { error: 'No orders found' };
    }

    const firstTable = orders[0].table.name;
    const items = orders.flatMap((o) => o.items);
    const subtotal = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    const lines = [
      'La Casona',
      `Mesa: ${firstTable}`,
      '----------------------',
      ...items.map((item) => `${item.quantity} x ${item.product.name} - ${Number(item.unitPrice).toFixed(2)}`),
      '----------------------',
      `Subtotal: ${subtotal.toFixed(2)}`,
      `IVA: ${tax.toFixed(2)}`,
      `Total: ${total.toFixed(2)}`,
    ];

    return { invoiceText: lines.join('\n') };
  }
}
