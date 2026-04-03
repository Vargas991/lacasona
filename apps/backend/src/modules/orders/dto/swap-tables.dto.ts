import { IsString } from 'class-validator';

export class SwapTablesDto {
  @IsString()
  fromTableId!: string;

  @IsString()
  toTableId!: string;
}
