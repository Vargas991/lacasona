import { IsEnum } from 'class-validator';
import { TableStatus } from '@prisma/client';

export class ChangeTableStatusDto {
  @IsEnum(TableStatus)
  status!: TableStatus;
}
