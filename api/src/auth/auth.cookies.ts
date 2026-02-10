import type { CookieOptions } from 'express';

export const AUTH_COOKIE_NAME = process.env.COOKIE_KEY_NAME!;

export function getAuthCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}
