import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CalculateChangeDto } from './dto/calculate-change.dto';
import { CloseAccountDto } from './dto/close-account.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
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

  @Post('sessions/open')
  @Roles('ADMIN', 'WAITER')
  openSession(@Body() dto: OpenCashSessionDto) {
    return this.cashService.openCashSession(dto);
  }

  @Get('sessions/active/:cashierId')
  @Roles('ADMIN', 'WAITER')
  getActiveSession(@Param('cashierId') cashierId: string) {
    return this.cashService.getActiveCashSession(cashierId);
  }

  @Get('sessions/:sessionId')
  @Roles('ADMIN', 'WAITER')
  getSession(@Param('sessionId') sessionId: string) {
    return this.cashService.getCashSession(sessionId);
  }

  @Get('sessions/:sessionId/movements')
  @Roles('ADMIN', 'WAITER')
  listMovements(@Param('sessionId') sessionId: string) {
    return this.cashService.listCashSessionMovements(sessionId);
  }

  @Post('sessions/:sessionId/movements')
  @Roles('ADMIN', 'WAITER')
  createMovement(
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.cashService.createCashMovement(sessionId, dto);
  }

  @Post('calculate-change')
  @Roles('ADMIN', 'WAITER')
  calculateChange(@Body() dto: CalculateChangeDto) {
    return this.cashService.calculateChange(dto);
  }

  @Post('sessions/:sessionId/close')
  @Roles('ADMIN', 'WAITER')
  closeSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cashService.closeCashSession(sessionId, dto);
  }
}
