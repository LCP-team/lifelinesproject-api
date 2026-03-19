import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './types/auth-user.type';
import { AuthProviderType } from '@prisma/client';

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

  login(user: AuthUser): { access_token: string } {
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { access_token: token };
  }
}
