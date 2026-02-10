import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('rank')
  // @UseGuards(AuthGuard('jwt')) // 公开还是需要鉴权？PRD 说玩家可查看。
  async getRank(@Query('limit') limit = 50) {
    const agents = await this.agentsService.getActiveAgents();
    // 按收入降序排序。
    const sorted = agents.sort(
      (a, b) => Number(b.currentIncome) - Number(a.currentIncome),
    );
    const top = sorted.slice(0, limit);

    return {
      agents: top,
      total: agents.length,
    };
  }

  @Post('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req: any) {
    const userId = req?.user?.userId;
    if (!userId || typeof userId !== 'string')
      throw new UnauthorizedException('Invalid token');

    const user = await this.usersService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');

    let agent = await this.agentsService.findOneByUserId(user.id);
    if (!agent) {
      agent = await this.agentsService.createDefaultAgent(user.id);
    }

    const avatar =
      user.metadata && typeof (user.metadata as any).avatar === 'string'
        ? ((user.metadata as any).avatar as string)
        : undefined;

    return {
      id: agent.id,
      identity: agent.identity,
      current_income: agent.currentIncome,
      working_hours: agent.workingHours,
      current_tick: agent.currentTick,
      interest_tags: agent.interestTags,
      user: {
        id: user.id,
        nickname: user.name,
        avatar,
      },
    };
  }
}
