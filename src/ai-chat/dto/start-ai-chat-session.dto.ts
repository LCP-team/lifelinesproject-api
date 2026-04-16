import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class StartAiChatSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  personality = 1;

  @IsOptional()
  @IsIn(['en', 'ind'])
  language: 'en' | 'ind' = 'en';

  @IsOptional()
  @IsBoolean()
  greeting = true;
}
