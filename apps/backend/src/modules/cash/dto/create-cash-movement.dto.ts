import { CashMovementType, PaymentCurrency, PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCashMovementDto {
  @IsString()
  createdById!: string;

  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @IsEnum(PaymentCurrency)
  currency!: PaymentCurrency;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentCurrency)
  relatedCurrency?: PaymentCurrency;

  @IsOptional()
  @IsNumber()
  @Min(0)
  relatedAmount?: number;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
