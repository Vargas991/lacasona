// @ts-ignore
const escpos = require('escpos');
const escposUSB = require('escpos-usb');
escpos.USB = escposUSB;

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import { exec } from 'child_process';

type TicketType = 'kitchen' | 'invoice';

// 🔥 Tipo Prisma (sin null gracias a findUniqueOrThrow)
type OrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: true;
      };
    };
    table: true;
    
  },
  select: {
    isDelivery: true;
    deliveryAddress: true;
  },
}>;

// 💰 DTOs
type InvoiceItemDTO = {
  qty: number;
  name: string;
  price: number;
};

type InvoiceDTO = {
  table: string;
  isDelivery?: boolean;
  deliveryAddress?: string;
  items: InvoiceItemDTO[];
  subtotal?: number;
  tax?: number;
  total: number;
};

type InvoicePreviewDTO = {
  orderId: string;
  table: string;
  subtotal: number;
  tax: number;
  total: number;
  previewText: string;
  escpos: string;
};

@Injectable()
export class PrintingService {
  constructor(private readonly prisma: PrismaService) {}

  private queue = Promise.resolve();

  // 🔥 Cola de impresión (evita corrupción)
  enqueuePrint(text: string) {
    this.queue = this.queue.then(() => this.print(text));
    return this.queue;
  }

  // 🔥 Router
  async print(text: string): Promise<void> {
    const simulate = process.env.PRINT_SIMULATE === 'true';
    if (simulate) {
      console.log('--- SIMULATED PRINT ---');
      console.log(text);
      console.log('--- END SIMULATED PRINT ---');
      return;
    }

    const type = process.env.PRINTER_TYPE || 'network';

    if (type === 'usb') {
      return this.printUSB(text);
    }
    if (type === 'file') {
      return this.printFile(text);
    }
    return this.printNetwork(text);
  }

  // 🖨️ Impresión por archivo (RAW)
  private async printFile(text: string): Promise<void> {
    // Carpeta temporal dentro del proyecto
    const testText = 'PRUEBA DE IMPRESIÓN DESDE BACKEND\n\n\n';
    console.log('[PRINT][FILE] testText:', testText);
    const tmpDir = `${process.cwd()}${require('path').sep}tmp`;
    console.log('[PRINT][FILE] tmpDir:', tmpDir);
    try {
      if (!fs.existsSync(tmpDir)) {
        console.log('[PRINT][FILE] tmpDir no existe, creando...');
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch (err) {
      console.error('[PRINT][FILE] Error creando tmpDir:', err);
      return;
    }
    const filePath = `${tmpDir}${require('path').sep}ticket-impresion.txt`;
    try {
      fs.writeFileSync(filePath, testText, { encoding: 'utf8' });
      console.log('[PRINT][FILE] Archivo creado:', filePath);
    } catch (err) {
      console.error('[PRINT][FILE] Error escribiendo archivo:', err);
      return;
    }

    // Comando para enviar el archivo a la impresora predeterminada o especificada
    const printerName = process.env.PRINTER_NAME || 'LPT1:';
    console.log('[PRINT][FILE] Enviando a impresora:', printerName);
    exec(`print /D:"${printerName}" "${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('[PRINT][FILE] Error al imprimir:', error);
      } else {
        console.log('[PRINT][FILE] Impresión enviada correctamente. stdout:', stdout);
      }
      // Opcional: eliminar el archivo después de imprimir
      try { fs.unlinkSync(filePath); console.log('[PRINT][FILE] Archivo eliminado:', filePath); } catch (e) { console.error('[PRINT][FILE] Error eliminando archivo:', e); }
    });
  }

  // 🌐 NETWORK
  private async printNetwork(text: string): Promise<void> {
    const PRINTER_IP = process.env.PRINTER_IP || '192.168.0.100';
    const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;

    const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
    const printer = new escpos.Printer(device);

    return new Promise((resolve, reject) => {
      device.open((error: any) => {
        if (error) return reject(error);

        const buffer = Buffer.from(text, 'latin1');

        printer.raw(buffer);
        printer.close(() => resolve());
      });
    });
  }

  // 🔌 USB
  private async printUSB(text: string): Promise<void> {
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);

    return new Promise((resolve, reject) => {
      device.open((error: any) => {
        if (error) return reject(error);

        const buffer = Buffer.from(text, 'latin1');

        printer.raw(buffer);
        printer.close(() => resolve());
      });
    });
  }

  // 🔥 Builder general
  private buildTicket(type: TicketType, data: OrderWithItems | InvoiceDTO): string {
    switch (type) {
      case 'kitchen':
        return this.buildKitchenEscpos(data as OrderWithItems);

      case 'invoice':
        return this.buildInvoiceEscpos(data as InvoiceDTO);

      default:
        throw new Error('Invalid ticket type');
    }
  }

  // 🍳 COCINA
  private buildKitchenEscpos(order: OrderWithItems): string {
    const hasCutter = process.env.PRINTER_HAS_CUTTER === 'true';

    
    
    let escpos = '';

    escpos += '\x1B\x40';
    escpos += '\x1B\x45\x01';
    escpos += '\n*** COCINA ***\n';
    escpos += '\x1B\x45\x00';

    escpos += `Comanda: #${String(order.dailySequence).padStart(3, '0')}\n`;
    if(order.isDelivery) {
      escpos += 'DELIVERY\n';
    } else {
      escpos += `Mesa: ${order.table.name}\n`;
    }
    escpos += `Fecha: ${order.dateKey}\n`;
    escpos += '----------------------\n';
    
    order.items.forEach((item) => {
      escpos += `${item.quantity} x ${item.product.name}`;
      if (item.note) escpos += ` | Nota: ${item.note}`;
      escpos += '\n';
    });


    escpos += '----------------------\n';
    escpos += '\n\n\n\n';

    if (hasCutter) {
      escpos += '\x1D\x56\x00';
    }

    return escpos;
  }

  // 💰 FACTURA / RECIBO
  private buildInvoiceEscpos(data: InvoiceDTO & { isDelivery?: boolean; deliveryAddress?: string }): string {
    const hasCutter = process.env.PRINTER_HAS_CUTTER === 'true';

    let escpos = '';

    escpos += '\x1B\x40';
    escpos += '\x1B\x45\x01';
    escpos += 'LA CASONA\n';
    escpos += '\x1B\x45\x00';

    if (data.isDelivery) {
      escpos += 'DELIVERY\n';
      if (data.deliveryAddress) {
        escpos += `Dirección:\n${data.deliveryAddress}\n`;
      }
    } else {
      escpos += `Mesa: ${data.table}\n`;
    }
    escpos += '----------------------\n';

    data.items.forEach((item) => {
      const total = item.qty * item.price;
      
      escpos += `${item.qty} x ${item.name}\n`;
      escpos += `   ${total.toFixed(2)}\n`;
    });
    
    escpos += '----------------------\n';

    if (typeof data.subtotal === 'number' && data.tax && data.tax > 0) {
      escpos += `SUBTOTAL: ${data.subtotal.toFixed(2)}\n`;
      escpos += `IVA: ${data.tax.toFixed(2)}\n`;
    }

    escpos += '\x1B\x45\x01';
    escpos += `TOTAL: ${data.total.toFixed(2)}\n`;
    escpos += '\x1B\x45\x00';

    escpos += '\n\n\n';

    if (hasCutter) {
      escpos += '\x1D\x56\x00';
    }

    return escpos;
  }

  // 🍳 PREVIEW + ESC/POS cocina
  async kitchenTicket(orderId: string) {
    const order: OrderWithItems = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: true } }, table: true },
    });

    const validationErrors: string[] = [];

    if (!order.table?.name?.trim()) {
      validationErrors.push('Table name is missing');
    }

    if (!order.items.length) {
      validationErrors.push('Order has no items');
    }

    const printable = validationErrors.length === 0;

    const escpos = printable ? this.buildTicket('kitchen', order) : '';

    const previewLines = [
      `          COCINA`,
      `        COMANDA #${String(order.dailySequence).padStart(3, '0')}\n`,
      order.isDelivery && order.table.name =="Delivery"
      ? `DELIVERY`
      : !order.isDelivery ? `Mesa: ${order.table.name}`
      : `**PEDIDO PARA LLEVAR** \nMesa: ${order.table.name}`,
      ,
      `Fecha: ${order.dateKey}`,
        
      '----------------------',
      
      ...order.items.map(
        (item) =>
          `${item.quantity} x ${item.product.name}\n${item.note ? `Nota: ${item.note}` : ''}`,
      ),
      '----------------------',
    ];

    return {
      orderId: order.id,
      printable,
      isDelivery: order.isDelivery ?? false,
      deliveryAddress: order.deliveryAddress,
      validationErrors,
      previewText: previewLines.join('\n'),
      escpos,
    };
  }

  // 💰 FACTURA POR MESA
  async simpleInvoiceByTable(tableId: string) {
    const ordersWhere = await this.getCurrentTableUnpaidWhere(tableId);

    const orders = await this.prisma.order.findMany({
      where: ordersWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        isDelivery: true,
        deliveryAddress: true,
        dailySequence: true,
        dateKey: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            createdAt: true,
            orderId: true,
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
        table: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }) as any[];

    if (!orders.length) {
      throw new NotFoundException('No open orders for table');
    }

    const tableName = orders[0].table.name;
    const items = orders.flatMap((o) => o.items);

    const subtotal = items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0,
    );

    const total = subtotal;

    const isDelivery = orders[0].isDelivery;
    const deliveryAddress = orders[0].deliveryAddress || undefined;
    const data: InvoiceDTO = {
      table: tableName,
      isDelivery,
      deliveryAddress,
      items: items.map((item) => ({
        qty: item.quantity,
        name: item.product.name,
        price: Number(item.unitPrice),
      })),
      subtotal,
      tax: 0,
      total,
    };

    const previewLines = [
      'LA CASONA',
      isDelivery ? 'DELIVERY' : `Mesa: ${tableName}`,
      isDelivery && deliveryAddress ? `Dirección: ${deliveryAddress}` : undefined,
      !isDelivery ? undefined : undefined, // solo para mantener el orden
      '----------------------',
      ...data.items.flatMap((item) => [
        `${item.qty} x ${item.name}`,
        `   ${(item.price * item.qty).toFixed(2)}`,
      ]),
      '----------------------',
      `TOTAL: ${total.toFixed(2)}`,
    ].filter(Boolean);

    const escpos = this.buildTicket('invoice', data);

    return {
      table: tableName,
      total,
      escpos,
      previewText: previewLines.join('\n'),
      isDelivery,
      deliveryAddress,
    };
  }

  async orderReceipt(orderId: string): Promise<InvoicePreviewDTO> {
    const order: OrderWithItems & {
      payment: {
        total: Prisma.Decimal;
      } | null;
    } = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        table: true,
        payment: {
          select: {
            total: true,
          },
        },
      },
    });

    if (!order.items.length) {
      throw new NotFoundException('Order has no items');
    }

    const subtotal = order.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    const tax = 0;
    const total = subtotal;

    const isDelivery = order.isDelivery;
    const deliveryAddress = order.deliveryAddress || undefined;
    const data: InvoiceDTO = {
      table: order.table.name,
      isDelivery,
      deliveryAddress,
      items: order.items.map((item) => ({
        qty: item.quantity,
        name: item.product.name,
        price: Number(item.unitPrice),
      })),
      subtotal,
      tax,
      total,
    };

    const previewLines = [
      'LA CASONA',
      isDelivery ? 'DELIVERY' : `Mesa: ${order.table.name}`,
      isDelivery && deliveryAddress ? `Dirección: \n ${deliveryAddress}` : undefined,
      isDelivery ? undefined : undefined, // solo para mantener el orden
      `Comanda #${String(order.dailySequence).padStart(3, '0')}`,
      '----------------------',
      ...data.items.flatMap((item) => [
        `${item.qty} x ${item.name}`,
        `   ${(item.price * item.qty).toFixed(2)}`,
      ]),
      '----------------------',
      `TOTAL: ${total.toFixed(2)}`,
    ].filter(Boolean);

    return {
      orderId: order.id,
      table: order.table.name,
      subtotal,
      tax,
      total,
      previewText: previewLines.join('\n'),
      escpos: this.buildTicket('invoice', data),
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
