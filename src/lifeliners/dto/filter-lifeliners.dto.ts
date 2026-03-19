import { AgeGroup } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';

export class FilterLifelinersDto {
  @IsOptional()
  @Transform(
    ({ value }) => (Array.isArray(value) ? value : [value]) as AgeGroup[],
  )
  @IsArray()
  @IsEnum(AgeGroup, { each: true })
  age_groups?: AgeGroup[];
}
