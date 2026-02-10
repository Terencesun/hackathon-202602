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
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from './auth.cookies';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
    res.cookie(AUTH_COOKIE_NAME, result.access_token, {
      ...getAuthCookieOptions(),
    });
    return { user: result.user, agent: result.agent };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, {
      ...getAuthCookieOptions(),
    });
    return { ok: true };
  }
}
