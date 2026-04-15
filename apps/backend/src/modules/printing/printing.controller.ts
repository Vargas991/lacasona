import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrintingService } from './printing.service';

@Controller('printing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  // 🍳 ===============================
  // 🍳 COCINA (PREVIEW)
  // 🍳 ===============================
  @Get('kitchen-ticket/:orderId')
  @Roles('ADMIN', 'KITCHEN', 'WAITER')
  kitchenTicket(@Param('orderId') orderId: string) {
    return this.printingService.kitchenTicket(orderId);
  }

  // 🍳 ===============================
  // 🍳 COCINA (PRINT)
  // 🍳 ===============================
  @Post('kitchen-ticket/:orderId/print')
  @Roles('ADMIN', 'KITCHEN', 'WAITER')
  async printKitchen(@Param('orderId') orderId: string) {
    const result = await this.printingService.kitchenTicket(orderId);

    console.log(result);
    
    if (!result.printable) {
      throw new BadRequestException({
        message: 'Ticket not printable',
        errors: result.validationErrors,
      });
    }

    await this.printingService.enqueuePrint(result.escpos);

    return {
      success: true,
      message: 'Kitchen ticket printed',
    };
  }

  // 💰 ===============================
  // 💰 FACTURA (PREVIEW)
  // 💰 ===============================
  @Get('invoice/:tableId')
  @Roles('ADMIN', 'WAITER')
  invoice(@Param('tableId') tableId: string) {
    return this.printingService.simpleInvoiceByTable(tableId);
  }

  // 💰 ===============================
  // 💰 FACTURA (PRINT)
  // 💰 ===============================
  @Post('invoice/:tableId/print')
  @Roles('ADMIN', 'WAITER')
  async printInvoice(@Param('tableId') tableId: string) {
    const result = await this.printingService.simpleInvoiceByTable(tableId);

    if (!result || !result.escpos) {
      throw new BadRequestException('Nothing to print');
    }

    await this.printingService.enqueuePrint(result.escpos);

    return {
      success: true,
      message: 'Invoice printed',
    };
  }

  @Get('receipt/:orderId')
  @Roles('ADMIN', 'WAITER')
  receipt(@Param('orderId') orderId: string) {
    return this.printingService.orderReceipt(orderId);
  }

  @Post('receipt/:orderId/print')
  @Roles('ADMIN', 'WAITER')
  async printReceipt(@Param('orderId') orderId: string) {
    const result = await this.printingService.orderReceipt(orderId);

    if (!result || !result.escpos) {
      throw new BadRequestException('Nothing to print');
    }

    await this.printingService.enqueuePrint(result.escpos);

    return {
      success: true,
      message: 'Receipt printed',
    };
  }

  // 🔧 ===============================
  // 🔧 DEBUG / TEST
  // 🔧 ===============================
  @Post('print-text')
  @Roles('ADMIN')
  async printText(@Body('text') text: string) {
    if (!text) {
      throw new BadRequestException('Text is required');
    }

    await this.printingService.enqueuePrint(text);

    return {
      success: true,
      message: 'Printed raw text',
    };
  }
}
