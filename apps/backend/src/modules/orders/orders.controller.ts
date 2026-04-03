import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { SwapTablesDto } from './dto/swap-tables.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('active')
  @Roles('ADMIN', 'WAITER', 'KITCHEN')
  listActive() {
    return this.ordersService.listActive();
  }

  @Get('history')
  @Roles('ADMIN', 'WAITER', 'KITCHEN')
  listHistory(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tableId') tableId?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: PaymentMethod,
    @Query('paymentGroup') paymentGroup?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.listHistory({
      from,
      to,
      tableId,
      status,
      paymentMethod,
      paymentGroup,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  @Roles('ADMIN', 'WAITER')
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Post('swap-tables')
  @Roles('ADMIN', 'WAITER')
  swapTables(@Body() dto: SwapTablesDto) {
    return this.ordersService.swapTables(dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'WAITER', 'KITCHEN')
  setStatus(@Param('id') id: string, @Body() dto: ChangeOrderStatusDto) {
    return this.ordersService.setStatus(id, dto);
  }
}
