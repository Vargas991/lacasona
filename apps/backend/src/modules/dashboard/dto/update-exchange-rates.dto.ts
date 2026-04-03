import { IsNumber, Min } from 'class-validator';

export class UpdateExchangeRatesDto {
  @IsNumber()
  @Min(0.0001)
  copToBsDivisor!: number;

  @IsNumber()
  @Min(0.0001)
  copToUsdDivisor!: number;
}
