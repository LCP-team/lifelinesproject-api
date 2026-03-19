import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@Injectable()
export class GoogleGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super({
      successRedirect: `${configService.get<string>('CLIENT_URL')}/`,
      failureRedirect: `${configService.get<string>('CLIENT_URL')}/auth`,
    });
  }

  async canActivate(context: ExecutionContext) {
    try {
      const user = await super.canActivate(context);
      return !!user;
    } catch {
      context
        .switchToHttp()
        .getResponse<Response>()
        .redirect(this.configService.get<string>('CLIENT_URL') + '/auth');
      return false;
    }
  }
}
