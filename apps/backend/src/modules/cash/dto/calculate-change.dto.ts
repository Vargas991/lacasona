import { PaymentCurrency } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class CalculateChangeDto {
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsEnum(PaymentCurrency)
  totalCurrency!: PaymentCurrency;

  @IsNumber()
  @Min(0)
  tenderedAmount!: number;

  @IsEnum(PaymentCurrency)
  tenderedCurrency!: PaymentCurrency;

  @IsOptional()
  @IsEnum(PaymentCurrency)
  changeCurrency?: PaymentCurrency;
}
