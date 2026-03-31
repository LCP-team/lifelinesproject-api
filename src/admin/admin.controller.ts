import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { createReadStream } from 'fs';
import { StreamableFile } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { AdminPaginationDto } from './dto/admin-pagination.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  findUsers(@Query() query: AdminPaginationDto) {
    return this.adminService.findUsers(query.page ?? 1, query.limit ?? 20);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeUser(@Param('id') id: string) {
    return this.adminService.removeUser(id);
  }

  @Get('lifeliners')
  findLifeliners(@Query() query: AdminPaginationDto) {
    return this.adminService.findLifeliners(query.page ?? 1, query.limit ?? 20);
  }

  @Get('lifeliners/:id/verification-photo')
  async getVerificationPhoto(@Param('id') id: string) {
    const filePath = await this.adminService.getVerificationPhotoPath(id);
    return new StreamableFile(createReadStream(filePath));
  }

  @Patch('lifeliners/:id/verify')
  verifyLifeliner(@Param('id') id: string) {
    return this.adminService.verifyLifeliner(id);
  }

  @Delete('lifeliners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLifeliner(@Param('id') id: string) {
    return this.adminService.removeLifeliner(id);
  }
}
