import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './types/auth-user.type';
import { AuthProviderType, Role } from '@prisma/client';
import { LifelinersService } from 'src/lifeliners/lifeliners.service';

interface FindOrCreateUserParams {
  provider: AuthProviderType;
  providerId: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly lifelinersService: LifelinersService,
  ) {}

  async findOrCreateUser(params: FindOrCreateUserParams): Promise<AuthUser> {
    const { provider, providerId, email } = params;

    // 1. Check if this OAuth provider link already exists
    const existingProvider = await this.prisma.authProvider.findUnique({
      where: {
        provider_provider_id: { provider, provider_id: providerId },
      },
      include: { user: true },
    });

    if (existingProvider) {
      const { user } = existingProvider;
      return { id: user.id, email: user.email, role: user.role };
    }

    // 2. Find or create the user, then link the provider — done in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      let existingUser = await tx.user.findUnique({ where: { email } });

      if (!existingUser) {
        existingUser = await tx.user.create({ data: { email } });
      }

      await tx.authProvider.create({
        data: {
          user_id: existingUser.id,
          provider,
          provider_id: providerId,
        },
      });

      return existingUser;
    });

    return { id: user.id, email: user.email, role: user.role };
  }

  async selectRole(userId: string, role: Role): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role !== null) {
      throw new ConflictException(
        'Role has already been set and cannot be changed',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    await this.lifelinersService.create(updated.id);

    return { id: updated.id, email: updated.email, role: updated.role };
  }

  login(user: AuthUser): { access_token: string } {
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { access_token: token };
  }

  async getUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
