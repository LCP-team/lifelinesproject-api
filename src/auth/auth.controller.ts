import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthUser } from './types/auth-user.type';
import { GoogleGuard } from './guards/google.guard';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SelectRoleDto } from './dto/select-role.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  @Get('google')
  @UseGuards(GoogleGuard)
  google() {}

  @Get('google/callback')
  @UseGuards(GoogleGuard)
  @HttpCode(HttpStatus.OK)
  googleCallback(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { access_token } = this.authService.login(user);

      const clientUrl = this.configService.getOrThrow<string>('CLIENT_URL');

      const destination =
        user.role === 'ADMIN'
          ? `/admin`
          : user.role === 'LIFELINER' || user.role === 'CLIENT'
            ? `${clientUrl}/profile/complete`
            : `${clientUrl}/select-role`;

      res
        .cookie('access_token', access_token, {
          httpOnly: true,
          signed: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge: 60 * 60 * 24 * 7,
          domain:
            process.env.NODE_ENV === 'production'
              ? '.lifelinesproject.com'
              : undefined,
        })
        .redirect(destination);
    } catch {
      res.redirect(`${this.configService.get<string>('CLIENT_URL')}/signin`);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getUser(user.id);
  }

  @Patch('role')
  @UseGuards(JwtAuthGuard)
  async selectRole(
    @CurrentUser() user: AuthUser,
    @Body() dto: SelectRoleDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.selectRole(user.id, dto.role);
    const { access_token } = this.authService.login(result);
    res.cookie('access_token', access_token, {
      httpOnly: true,
      signed: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 60 * 60 * 24 * 7,
      domain:
        process.env.NODE_ENV === 'production'
          ? '.lifelinesproject.com'
          : undefined,
    });
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 0,
      domain:
        process.env.NODE_ENV === 'production'
          ? '.lifelinesproject.com'
          : undefined,
    });
  }
}
