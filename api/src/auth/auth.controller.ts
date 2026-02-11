import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { AuthCookiesService } from './auth.cookies';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authCookies: AuthCookiesService,
    private configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { code: string; redirectUri?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithSecondMe(
      body.code,
      body.redirectUri,
    );

    res.cookie(
      this.authCookies.getAuthCookieName(
        this.configService.get<string>('COOKIE_KEY_NAME'),
      ),
      result.access_token,
      {
        ...this.authCookies.getAuthCookieOptions(),
      },
    );
    return { user: result.user, agent: result.agent };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(
      this.authCookies.getAuthCookieName(
        this.configService.get<string>('COOKIE_KEY_NAME'),
      ),
      {
        ...this.authCookies.getAuthCookieOptions(),
      },
    );
    return { ok: true };
  }
}
