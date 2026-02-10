import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_COOKIE_NAME } from './auth.cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const cookieExtractor = (req: any): string | null => {
      const signedValue = req?.signedCookies?.[AUTH_COOKIE_NAME];
      if (typeof signedValue === 'string' && signedValue) return signedValue;
      const unsignedValue = req?.cookies?.[AUTH_COOKIE_NAME];
      if (typeof unsignedValue === 'string' && unsignedValue) return unsignedValue;
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
