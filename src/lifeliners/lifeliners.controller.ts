import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CreateLifelinerDto } from './dto/create-lifeliner.dto';
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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLifelinerDto) {
    return this.lifelinersService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLifelinerDto,
  ) {
    return this.lifelinersService.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifelinersService.remove(id, user.id);
  }
}
