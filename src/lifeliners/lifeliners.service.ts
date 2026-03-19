import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLifelinerDto } from './dto/create-lifeliner.dto';
import { UpdateLifelinerDto } from './dto/update-lifeliner.dto';
import { AgeGroup } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

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

  async create(userId: string, dto: CreateLifelinerDto) {
    const existing = await this.prisma.lifeliner.findUnique({
      where: { user_id: userId },
    });
    if (existing)
      throw new ConflictException('Lifeliner profile already exists');

    return this.prisma.lifeliner.create({
      data: { user_id: userId, ...dto },
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
}
