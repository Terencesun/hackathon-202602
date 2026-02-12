import { Injectable } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { UsersService } from '../users/users.service';
import { SecondmeService } from '../secondme/secondme.service';
import { AgentIdentity } from '../agents/agent.entity';

export type DecisionResult = {
  next_identity?: AgentIdentity;
  accept?: boolean;
  reason?: string;
  error?: string;
};

@Injectable()
export class ChatService {
  constructor(
    private agentsService: AgentsService,
    private usersService: UsersService,
    private secondmeService: SecondmeService,
  ) {}

  async sendChat(agentId: string, content: string): Promise<DecisionResult> {
    const accessToken = await this.resolveAccessToken(agentId);
    if (!accessToken) {
      return { error: 'SecondMe access token missing' };
    }

    const actionControl = this.buildActionControl(content);
    if (!actionControl) {
      return { error: 'Unknown prompt type' };
    }

    const systemPrompt = '只输出合法 JSON 对象，不要解释。';

    console.log({ message: content, actionControl, systemPrompt });

    try {
      const { text: outputText } =
        await this.secondmeService.actStreamCollectText(accessToken, {
          message: content,
          actionControl,
          systemPrompt,
        });

      const decision = this.parseDecisionResult(outputText);
      console.log(decision);
      return decision;
    } catch (err: unknown) {
      const anyErr = err as {
        message?: string;
        response?: { status?: number };
      };
      const status =
        typeof anyErr?.response?.status === 'number'
          ? anyErr.response.status
          : undefined;
      const msg = anyErr?.message ? String(anyErr.message) : 'unknown error';
      return {
        error: status ? `SecondMe request failed (${status}): ${msg}` : msg,
      };
    }
  }

  private async resolveAccessToken(agentId: string): Promise<string | null> {
    const agent = await this.agentsService.findOne(agentId);
    if (!agent) return null;
    const user = await this.usersService.findOne(agent.userId);
    const metadata = user?.metadata ?? {};
    const tokenFromUser =
      typeof (metadata as Record<string, unknown>).accessToken === 'string'
        ? String((metadata as Record<string, unknown>).accessToken)
        : null;
    if (tokenFromUser) return tokenFromUser;
    return null;
  }

  private buildActionControl(content: string): string | null {
    if (content.includes('确定你当前的职业身份')) {
      return [
        '仅输出合法 JSON 对象，不要解释，不要输出 Markdown 或代码块。',
        '输出结构示例：{"next_identity": string,"reason": string}。',
        '规则：',
        'next_identity 可选值：worker、broker、layflat。',
        'reason 给出一句话原因。',
      ].join('\n');
    }

    if (content.includes('中介建立绑定关系')) {
      return [
        '仅输出合法 JSON 对象，不要解释，不要输出 Markdown 或代码块。',
        '输出结构示例：{"accept": boolean, "reason": string}。',
        '规则：根据邀请条件判断是否接受；信息不足时 accept=false。',
        'reason 给出一句话原因。',
      ].join('\n');
    }

    return null;
  }

  private parseDecisionResult(text: string): DecisionResult {
    const jsonText = this.extractJsonObject(text);
    if (!jsonText) {
      return {
        error: 'Failed to parse DecisionResult JSON',
        reason: text.slice(0, 500),
      };
    }

    try {
      const obj = JSON.parse(jsonText) as Record<string, unknown>;
      const result: DecisionResult = {};
      if (typeof obj.accept === 'boolean') result.accept = obj.accept;
      if (typeof obj.reason === 'string') result.reason = obj.reason;
      if (typeof obj.error === 'string') result.error = obj.error;
      if (typeof obj.next_identity === 'string')
        result.next_identity = obj.next_identity as AgentIdentity;
      return Object.keys(result).length
        ? result
        : { error: 'Empty DecisionResult' };
    } catch {
      return {
        error: 'Failed to parse DecisionResult JSON',
        reason: text.slice(0, 500),
      };
    }
  }

  private extractJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return text.slice(start, end + 1);
  }
}
