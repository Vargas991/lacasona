import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { TablesModule } from '../tables/tables.module';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [OrdersModule, TablesModule],
  controllers: [CashController],
  providers: [CashService],
})
export class CashModule {}
