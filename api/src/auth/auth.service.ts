import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AgentsService } from '../agents/agents.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SecondmeService } from '../secondme/secondme.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private agentsService: AgentsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private secondmeService: SecondmeService,
  ) {}

  async loginWithSecondMe(code: string, redirectUri?: string) {
    const clientId = this.configService.get<string>('SECONDME_CLIENT_ID') || '';
    const clientSecret =
      this.configService.get<string>('SECONDME_CLIENT_SECRET') || '';
    const defaultRedirectUri =
      this.configService.get<string>('SECONDME_REDIRECT_URI') || '';

    try {
      const tokenPayload = await this.secondmeService.oauthTokenByCode({
        code,
        redirectUri: redirectUri || defaultRedirectUri,
        clientId,
        clientSecret,
      });
      const accessToken: string = tokenPayload.accessToken;
      const refreshToken: string | undefined = tokenPayload.refreshToken;
      if (!accessToken) {
        throw new Error('Access token not returned');
      }

      const userInfo = await this.secondmeService.userInfo(accessToken);
      console.log(userInfo);
      
      if (!userInfo?.userId) {
        throw new Error('User info not returned');
      }

      const secondMeId = userInfo.userId;
      const email = userInfo.email ?? `${secondMeId}@second.me`;
      const name = userInfo.name ?? secondMeId;
      const avatar =
        typeof userInfo.avatar === 'string' && userInfo.avatar.trim()
          ? userInfo.avatar
          : '';

      // 3. 查找或创建用户。
      let user = await this.usersService.findBySecondMeId(secondMeId);
      const nextMetadata = {
        ...(user?.metadata ?? {}),
        accessToken,
        ...(typeof refreshToken === 'string' ? { refreshToken } : {}),
        ...(avatar ? { avatar } : {}),
      };
      if (!user) {
        user = await this.usersService.create({
          secondmeId: secondMeId,
          email,
          name,
          metadata: nextMetadata,
        });
      } else {
        user = await this.usersService.update(user.id, {
          email,
          name,
          metadata: nextMetadata,
        });
        if (!user) {
          throw new UnauthorizedException('User not found');
        }
      }

      // 4. 确保 Agent 已存在。
      let agent = await this.agentsService.findOneByUserId(user.id);
      if (!agent) {
        agent = await this.agentsService.createDefaultAgent(user.id);
      }

      // 5. 生成 JWT。
      const payload = { username: user.name, sub: user.id };
      return {
        access_token: this.jwtService.sign(payload),
        user,
        agent,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to authenticate with SecondMe');
    }
  }
}
