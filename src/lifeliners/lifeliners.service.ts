import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROFILE_PICTURES_DIR,
  StorageService,
  VERIFICATION_PHOTOS_DIR,
} from '../storage/storage.service';
import { CreateLifelinerDto } from './dto/create-lifeliner.dto';
import { UpdateLifelinerDto } from './dto/update-lifeliner.dto';
import { AgeGroup, Prisma } from '@prisma/client';

// Fields safe to return on public endpoints — never includes private_picture or full_name
const PUBLIC_SELECT = {
  id: true,
  display_name: true,
  age: true,
  profile_picture: true,
  about_me: true,
  age_groups: true,
  created_at: true,
} as const;

@Injectable()
export class LifelinersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  findAll(ageGroups?: AgeGroup[]) {
    return this.prisma.lifeliner.findMany({
      where: ageGroups?.length
        ? { age_groups: { hasSome: ageGroups } }
        : undefined,
      select: PUBLIC_SELECT,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    return lifeliner;
  }

  async create(userId: string, dto?: CreateLifelinerDto) {
    const existing = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
    });
    if (existing)
      throw new ConflictException('Lifeliner profile already exists');

    const data: Omit<Prisma.LifelinerCreateInput, 'user'> = {
      ...(dto ?? {
        full_name: '',
        display_name: '',
        age: 0,
        about_me: '',
        age_groups: [],
      }),
      private_picture: '',
      profile_picture: '',
    };

    return this.prisma.lifeliner.create({
      data: { user_id: userId, ...data },
    });
  }

  async update(id: string, userId: string, dto: UpdateLifelinerDto) {
    const lifeliner = await this.prisma.lifeliner.findUnique({ where: { id } });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    if (lifeliner.user_id !== userId) throw new ForbiddenException();

    return this.prisma.lifeliner.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({ where: { id } });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    if (lifeliner.user_id !== userId) throw new ForbiddenException();

    await this.prisma.lifeliner.delete({ where: { id } });
  }

  async updateProfilePicture(userId: string, filename: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
      select: { id: true, profile_picture: true },
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');

    // Delete old file if it exists
    if (lifeliner.profile_picture) {
      const oldFilename = lifeliner.profile_picture.split('/').pop()!;
      await this.storage.deleteFile(join(PROFILE_PICTURES_DIR, oldFilename));
    }

    const publicUrl = `/uploads/public/profile-pictures/${filename}`;
    return this.prisma.lifeliner.update({
      where: { user_id: userId },
      data: { profile_picture: publicUrl },
      select: { id: true, profile_picture: true },
    });
  }

  async updateVerificationPhoto(userId: string, filename: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
      select: { id: true, private_picture: true },
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');

    // Delete old file if it exists
    if (lifeliner.private_picture) {
      const oldFilename = lifeliner.private_picture.split('/').pop()!;
      await this.storage.deleteFile(join(VERIFICATION_PHOTOS_DIR, oldFilename));
    }

    const filePath = join(VERIFICATION_PHOTOS_DIR, filename);
    return this.prisma.lifeliner.update({
      where: { user_id: userId },
      data: { private_picture: filePath },
      select: { id: true },
    });
  }

  async getVerificationPhotoPath(userId: string): Promise<string> {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
      select: { private_picture: true },
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    if (!lifeliner.private_picture)
      throw new NotFoundException('No verification photo uploaded');
    return lifeliner.private_picture;
  }
}
