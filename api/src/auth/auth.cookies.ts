import type { CookieOptions } from 'express';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthCookiesService {
  getAuthCookieName(cookieKeyName: string | null | undefined): string {
    if (typeof cookieKeyName === 'string' && cookieKeyName.trim()) {
      return cookieKeyName.trim();
    }
    throw new Error('COOKIE_KEY_NAME is required to set/read auth cookie');
  }

  getAuthCookieOptions(): CookieOptions {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    };
  }
}
