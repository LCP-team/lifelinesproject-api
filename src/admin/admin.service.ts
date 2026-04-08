import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findUsers(page: number, limit: number) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          created_at: true,
          lifeliner: {
            select: { id: true, display_name: true, is_verified: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async removeUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
  }

  async findLifeliners(page: number, limit: number) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lifeliner.findMany({
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lifeliner.count(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async verifyLifeliner(id: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({ where: { id } });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    return this.prisma.lifeliner.update({
      where: { id },
      data: { is_verified: !lifeliner.is_verified },
    });
  }

  async removeLifeliner(id: string) {
    const lifeliner = await this.prisma.lifeliner.findUnique({ where: { id } });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    await this.prisma.lifeliner.delete({ where: { id } });
  }

  async getVerificationPhotoPath(id: string): Promise<string> {
    const lifeliner = await this.prisma.lifeliner.findUnique({
      where: { id },
      select: { private_picture: true },
    });
    if (!lifeliner) throw new NotFoundException('Lifeliner not found');
    if (!lifeliner.private_picture)
      throw new NotFoundException('No verification photo uploaded');
    return lifeliner.private_picture;
  }
}
