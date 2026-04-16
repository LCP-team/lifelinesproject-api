import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthUser } from '../auth/types/auth-user.type';
import { AiChatService } from './ai-chat.service';
import { SendAiChatMessageDto } from './dto/send-ai-chat-message.dto';
import { StartAiChatSessionDto } from './dto/start-ai-chat-session.dto';

@Controller('ai-chat')
export class AiChatController {
  constructor(
    private readonly aiChatService: AiChatService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('status')
  getStatus(@Headers('x-trace-id') traceId?: string) {
    return this.aiChatService.getStatus(traceId);
  }

  @Post('session')
  startSession(
    @Req() req: Request,
    @Body() dto: StartAiChatSessionDto,
    @Headers('x-trace-id') traceId?: string,
  ) {
    const user = this.resolveUser(req);
    return this.aiChatService.startSession(user, dto, traceId);
  }

  @Post('messages')
  sendMessage(
    @Req() req: Request,
    @Body() dto: SendAiChatMessageDto,
    @Headers('x-trace-id') traceId?: string,
  ) {
    const user = this.resolveUser(req);
    return this.aiChatService.sendMessage(user, dto, traceId);
  }

  @Delete('session/:sessionId')
  closeSession(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    const user = this.resolveUser(req);
    return this.aiChatService.closeSession(user, sessionId, traceId);
  }

  private resolveUser(req: Request): AuthUser {
    const token = this.readSignedCookie(req, 'access_token');

    if (token) {
      try {
        const payload = this.jwtService.verify<{
          sub: string;
          email: string;
          role: AuthUser['role'];
        }>(token, {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        });

        return {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
      } catch {
        if (!this.isDevModeEnabled()) {
          throw new UnauthorizedException('Invalid access token');
        }
      }
    }

    if (this.isDevModeEnabled()) {
      return {
        id:
          this.configService.get<string>('AI_CHAT_DEV_USER_ID') ||
          'local-ai-demo',
        email:
          this.configService.get<string>('AI_CHAT_DEV_EMAIL') ||
          'local-ai-demo@localhost',
        role: null,
      };
    }

    throw new UnauthorizedException('Sign in required');
  }

  private readSignedCookie(
    req: Request,
    cookieName: string,
  ): string | undefined {
    const signedCookies = req.signedCookies as
      | Record<string, string>
      | undefined;

    return signedCookies?.[cookieName];
  }

  private isDevModeEnabled(): boolean {
    const rawValue = (
      this.configService.get<string>('AI_CHAT_DEV_MODE') || ''
    ).toLowerCase();

    return ['1', 'true', 'yes', 'on'].includes(rawValue);
  }
}
