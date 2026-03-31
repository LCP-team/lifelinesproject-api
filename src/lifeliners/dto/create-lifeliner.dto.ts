import { AgeGroup } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateLifelinerDto {
  @IsString()
  @IsNotEmpty()
  full_name: string = '';

  @IsString()
  @IsNotEmpty()
  display_name: string = '';

  @IsInt()
  @Min(18)
  @Max(120)
  @Transform(({ value }) => parseInt(`${value}`, 10))
  age: number = 0;

  @IsString()
  @IsNotEmpty()
  about_me: string = '';

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AgeGroup, { each: true })
  age_groups: AgeGroup[] = [];
}
