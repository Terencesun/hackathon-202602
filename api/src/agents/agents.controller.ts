import {
  Controller,
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

  @Post('rank')
  @UseGuards(AuthGuard('jwt'))
  async getRank(@Query('limit') limit = 10, @Req() req: any) {
    const userId = req?.user?.userId;
    return this.agentsService.getRank(userId, limit);
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

  @Post('me/transactions')
  @UseGuards(AuthGuard('jwt'))
  async getMeTransactions(@Req() req: any) {
    const userId = req?.user?.userId;
    if (!userId || typeof userId !== 'string')
      throw new UnauthorizedException('Invalid token');

    const agent = await this.agentsService.findOneByUserId(userId);
    if (!agent) {
      return [];
    }

    return this.agentsService.getMeTransactions(agent.id);
  }
}
