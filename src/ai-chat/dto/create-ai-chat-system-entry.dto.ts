import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAiChatSystemEntryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sessionId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;

  @IsString()
  @IsIn(['memory-on', 'memory-off', 'session-start', 'session-end'])
  boundaryType!: 'memory-on' | 'memory-off' | 'session-start' | 'session-end';
}