import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { FilterLifelinersDto } from './dto/filter-lifeliners.dto';
import { UpdateLifelinerDto } from './dto/update-lifeliner.dto';
import { LifelinersService } from './lifeliners.service';

const imageFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
    return cb(
      new BadRequestException('Only JPEG, PNG, or WebP images are allowed'),
      false,
    );
  }
  cb(null, true);
};

@Controller('lifeliners')
export class LifelinersController {
  constructor(private readonly lifelinersService: LifelinersService) {}

  @Get()
  findAll(@Query() query: FilterLifelinersDto) {
    return this.lifelinersService.findAll(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  async me(@CurrentUser() user: AuthUser) {
    const res = await this.lifelinersService.findForUser(user.id);
    return {
      ...res,
      private_picture: '/lifeliners/private/verification-photo',
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lifelinersService.findOne(id);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateLifelinerDto) {
    const lifeliner = await this.lifelinersService.findForUser(user.id);
    return this.lifelinersService.update(lifeliner.id, user.id, dto);
  }

  @Post('upload/profile-picture')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadProfilePicture(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.lifelinersService.updateProfilePicture(
      user.id,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
  }

  @Post('upload/verification-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadVerificationPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.lifelinersService.updateVerificationPhoto(
      user.id,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
  }

  @Get('private/verification-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  async getVerificationPhoto(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, contentType } =
      await this.lifelinersService.getVerificationPhoto(user.id);
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  }
}
