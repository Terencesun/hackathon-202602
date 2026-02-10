import { Readable } from 'stream';
import { collectSecondMeSseText } from './secondme.sse';

describe('collectSecondMeSseText', () => {
  it('collects sessionId and delta text', async () => {
    const lines = [
      'event: session\n',
      'data: {"sessionId":"labs_sess_123"}\n',
      '\n',
      'data: {"choices":[{"delta":{"content":"你"}}]}\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n',
      'data: [DONE]\n',
    ];

    const stream = Readable.from(lines);
    const result = await collectSecondMeSseText(stream);
    expect(result).toEqual({ sessionId: 'labs_sess_123', text: '你好' });
  });

  it('throws on error event payload', async () => {
    const lines = [
      'event: error\n',
      'data: {"code":500,"message":"服务内部错误"}\n',
      'data: [DONE]\n',
    ];
    const stream = Readable.from(lines);
    await expect(collectSecondMeSseText(stream)).rejects.toThrow('服务内部错误');
  });
});

