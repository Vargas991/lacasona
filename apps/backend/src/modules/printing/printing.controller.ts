import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrintingService } from './printing.service';

@Controller('printing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  @Get('kitchen-ticket/:orderId')
  @Roles('ADMIN', 'KITCHEN', 'WAITER')
  kitchenTicket(@Param('orderId') orderId: string) {
    return this.printingService.kitchenTicket(orderId);
  }

  @Get('invoice/:tableId')
  @Roles('ADMIN', 'WAITER')
  invoice(@Param('tableId') tableId: string) {
    return this.printingService.simpleInvoiceByTable(tableId);
  }
}
