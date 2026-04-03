import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChangeOrderStatusDto } from '../orders/dto/change-order-status.dto';
import { OrdersService } from '../orders/orders.service';

@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'KITCHEN')
export class KitchenController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('board')
  board() {
    return this.ordersService.listActive();
  }

  @Patch('orders/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: ChangeOrderStatusDto) {
    return this.ordersService.setStatus(id, dto);
  }
}
