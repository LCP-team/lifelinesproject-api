import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { FilterLifelinersDto } from './dto/filter-lifeliners.dto';
import { UpdateLifelinerDto } from './dto/update-lifeliner.dto';
import { LifelinersService } from './lifeliners.service';
import { Role } from '@prisma/client';

@Controller('lifeliners')
export class LifelinersController {
  constructor(private readonly lifelinersService: LifelinersService) {}

  @Get()
  findAll(@Query() query: FilterLifelinersDto) {
    return this.lifelinersService.findAll(query.age_groups);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lifelinersService.findOne(id);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateLifelinerDto) {
    return this.lifelinersService.update(user.id, user.id, dto);
  }
}
