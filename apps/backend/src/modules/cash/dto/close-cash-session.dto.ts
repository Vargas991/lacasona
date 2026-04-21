import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseCashSessionDto {
  @IsString()
  closedById!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  countedCop?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  countedBs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  countedUsd?: number;

  @IsOptional()
  @IsString()
  closingNote?: string;
}
