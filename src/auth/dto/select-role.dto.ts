import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class SelectRoleDto {
  @IsEnum(Role)
  role: Role;
}
