import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { UpdateExchangeRatesDto } from './dto/update-exchange-rates.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('ADMIN')
  stats(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.basicStats({ from, to });
  }

  @Patch('exchange-rates')
  @Roles('ADMIN')
  updateExchangeRates(@Body() dto: UpdateExchangeRatesDto) {
    return this.dashboardService.updateExchangeRates(dto);
  }
}
