import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CloseAccountDto } from './dto/close-account.dto';
import { CashService } from './cash.service';

@Controller('cash')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('preview/:tableId')
  @Roles('ADMIN', 'WAITER')
  preview(@Param('tableId') tableId: string) {
    return this.cashService.previewTableAccount(tableId);
  }

  @Post('close-table')
  @Roles('ADMIN', 'WAITER')
  closeTable(@Body() dto: CloseAccountDto) {
    return this.cashService.closeTableAccount(dto);
  }
}
