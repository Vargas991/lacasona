import { IsEnum, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CloseAccountDto {
  @IsString()
  tableId!: string;

  @IsString()
  cashierId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
