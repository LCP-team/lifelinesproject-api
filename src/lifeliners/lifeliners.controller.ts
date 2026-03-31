import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { createReadStream } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import {
  PROFILE_PICTURES_DIR,
  VERIFICATION_PHOTOS_DIR,
} from '../storage/storage.service';
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

const multerFilename = (
  req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, filename: string) => void,
) => {
  const user = (req as { user: AuthUser }).user;
  cb(null, `${user.id}-${Date.now()}${extname(file.originalname)}`);
};

@Controller('lifeliners')
export class LifelinersController {
  constructor(private readonly lifelinersService: LifelinersService) {}

  @Get()
  findAll(@Query() query: FilterLifelinersDto) {
    return this.lifelinersService.findAll(query.age_groups);
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
      storage: diskStorage({
        destination: PROFILE_PICTURES_DIR,
        filename: multerFilename,
      }),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadProfilePicture(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.lifelinersService.updateProfilePicture(user.id, file.filename);
  }

  @Post('upload/verification-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: VERIFICATION_PHOTOS_DIR,
        filename: multerFilename,
      }),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadVerificationPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.lifelinersService.updateVerificationPhoto(
      user.id,
      file.filename,
    );
  }

  @Get('private/verification-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LIFELINER)
  async getVerificationPhoto(@CurrentUser() user: AuthUser) {
    const filePath = await this.lifelinersService.getVerificationPhotoPath(
      user.id,
    );
    return new StreamableFile(createReadStream(filePath));
  }
}
