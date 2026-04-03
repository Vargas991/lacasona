import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CashModule } from './modules/cash/cash.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventsModule } from './modules/events/events.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PrintingModule } from './modules/printing/printing.module';
import { TablesModule } from './modules/tables/tables.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    UsersModule,
    AuthModule,
    TablesModule,
    ProductsModule,
    OrdersModule,
    KitchenModule,
    CashModule,
    PrintingModule,
    DashboardModule,
  ],
})
export class AppModule {}
