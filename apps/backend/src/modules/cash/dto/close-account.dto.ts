import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentCurrency, PaymentMethod } from '@prisma/client';

export class CloseAccountDto {
  @IsString()
  tableId!: string;

  @IsString()
  cashierId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentCurrency)
  tenderedCurrency?: PaymentCurrency;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tenderedAmount?: number;

  @IsOptional()
  @IsEnum(PaymentCurrency)
  changeCurrency?: PaymentCurrency;

  @IsOptional()
  @IsBoolean()
  registerInCashSession?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
