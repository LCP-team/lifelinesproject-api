import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROFILE_PICTURES_PREFIX,
  StorageService,
  VERIFICATION_PHOTOS_PREFIX,
} from '../storage/storage.service';
import { CreateLifelinerDto } from './dto/create-lifeliner.dto';
import { FilterLifelinersDto } from './dto/filter-lifeliners.dto';
import { UpdateLifelinerDto } from './dto/update-lifeliner.dto';
import { Prisma } from '@prisma/client';

// Fields safe to return on public endpoints — never includes private_picture or full_name
const PUBLIC_SELECT = {
  id: true,
  display_name: true,
  age: true,
  profile_picture: true,
  about_me: true,
  age_groups: true,
  is_verified: true,
  created_at: true,
} as const;

@Injectable()
export class LifelinersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findAll(dto: FilterLifelinersDto) {
    const { age_groups, search, min_age, max_age, page = 1, limit = 20 } = dto;

    const where: Prisma.LifelinerWhereInput = {
      is_verified: true,
      ...(age_groups?.length && { age_groups: { hasSome: age_groups } }),
      ...(search?.trim() && {
        display_name: { contains: search.trim(), mode: 'insensitive' },
      }),
      ...((min_age !== undefined || max_age !== undefined) && {
        age: {
          ...(min_age !== undefined && { gte: min_age }),
          ...(max_age !== undefined && { lte: max_age }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lifeliner.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lifeliner.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    return lifeliner;
  }

  async findForUser(userId: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
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

  async update(id: string, _userId: string, dto: UpdateLifelinerDto) {
    const lifeliner = await this.prisma.lifeliner.findUnique({ where: { id } });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    // if (lifeliner.user_id !== userId) throw new ForbiddenException();

    return this.prisma.lifeliner.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({ where: { id } });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');

    await this.prisma.lifeliner.delete({ where: { id } });
  }

  async updateProfilePicture(
    userId: string,
    buffer: Buffer,
    contentType: string,
    originalName: string,
  ) {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
      select: { id: true, profile_picture: true },
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');

    // Delete old file from GCS if it exists
    if (lifeliner.profile_picture) {
      const oldPath = this.extractGcsPath(lifeliner.profile_picture);
      if (oldPath) await this.storage.deleteFile(oldPath);
    }

    const ext = extname(originalName);
    const destination = `${PROFILE_PICTURES_PREFIX}/${userId}-${Date.now()}${ext}`;
    await this.storage.upload(destination, buffer, contentType);
    const publicUrl = this.storage.getPublicUrl(destination);

    return this.prisma.lifeliner.update({
      where: { user_id: userId },
      data: { profile_picture: publicUrl },
      select: { id: true, profile_picture: true },
    });
  }

  async updateVerificationPhoto(
    userId: string,
    buffer: Buffer,
    contentType: string,
    originalName: string,
  ) {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
      select: { id: true, private_picture: true },
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');

    // Delete old file from GCS if it exists
    if (lifeliner.private_picture) {
      await this.storage.deleteFile(lifeliner.private_picture);
    }

    const ext = extname(originalName);
    const destination = `${VERIFICATION_PHOTOS_PREFIX}/${userId}-${Date.now()}${ext}`;
    await this.storage.upload(destination, buffer, contentType);

    return this.prisma.lifeliner.update({
      where: { user_id: userId },
      data: { private_picture: destination },
      select: { id: true },
    });
  }

  async getVerificationPhoto(userId: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
  }> {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
      select: { private_picture: true },
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    if (!lifeliner.private_picture)
      throw new NotFoundException('No verification photo uploaded');

    return this.storage.download(lifeliner.private_picture);
  }

  private extractGcsPath(url: string): string | null {
    const prefix = `https://storage.googleapis.com/`;
    if (!url.startsWith(prefix)) return null;
    const withoutPrefix = url.slice(prefix.length);
    const firstSlash = withoutPrefix.indexOf('/');
    if (firstSlash === -1) return null;
    return withoutPrefix.slice(firstSlash + 1);
  }
}
