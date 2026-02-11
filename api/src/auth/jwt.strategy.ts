import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthCookiesService } from './auth.cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    authCookies: AuthCookiesService,
  ) {
    const authCookieName = authCookies.getAuthCookieName(
      configService.get<string>('COOKIE_KEY_NAME'),
    );
    const cookieExtractor = (req: any): string | null => {
      const signedValue = req?.signedCookies?.[authCookieName];
      if (typeof signedValue === 'string' && signedValue) return signedValue;
      const unsignedValue = req?.cookies?.[authCookieName];
      if (typeof unsignedValue === 'string' && unsignedValue)
        return unsignedValue;
      return null;
    };

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: { sub: string; username: string }) {
    return { userId: payload.sub, username: payload.username };
  }
}
