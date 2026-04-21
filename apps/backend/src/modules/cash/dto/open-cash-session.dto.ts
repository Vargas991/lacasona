import { PaymentCurrency } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenCashSessionDto {
  @IsString()
  cashierId!: string;

  @IsEnum(PaymentCurrency)
  openingCurrency!: PaymentCurrency;

  @IsNumber()
  @Min(0)
  openingAmount!: number;

  @IsOptional()
  @IsString()
  openingNote?: string;
}
