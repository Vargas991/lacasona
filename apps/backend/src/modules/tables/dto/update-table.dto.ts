import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTableDto {
	@IsOptional()
	@IsString()
	name?: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(30)
	capacity?: number;

	@IsOptional()
	@IsString()
	zone?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	layoutX?: number;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	layoutY?: number;
}
