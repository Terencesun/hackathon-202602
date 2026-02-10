import type { Readable } from 'stream';
import type { SecondMeSseCollectResult } from './secondme.types';

export async function collectSecondMeSseText(
  stream: Readable,
): Promise<SecondMeSseCollectResult> {
  let buffer = '';
  let output = '';
  let sessionId: string | undefined;
  let currentEvent: string | null = null;

  for await (const chunk of stream) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let idx = buffer.indexOf('\n');
    while (idx !== -1) {
      const rawLine = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      const line = rawLine.replace(/\r$/, '').trim();
      if (!line) {
        idx = buffer.indexOf('\n');
        continue;
      }

      if (line.startsWith('event:')) {
        currentEvent = line.slice('event:'.length).trim();
        idx = buffer.indexOf('\n');
        continue;
      }
      if (!line.startsWith('data:')) {
        idx = buffer.indexOf('\n');
        continue;
      }

      const data = line.slice('data:'.length).trim();
      if (data === '[DONE]') {
        stream.removeAllListeners();
        stream.destroy();
        return { sessionId, text: output };
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch {
        currentEvent = null;
        idx = buffer.indexOf('\n');
        continue;
      }

      if (currentEvent === 'session') {
        const sid = payload.sessionId;
        if (typeof sid === 'string') sessionId = sid;
        currentEvent = null;
        idx = buffer.indexOf('\n');
        continue;
      }
      if (currentEvent === 'error') {
        const msg =
          typeof payload.message === 'string' ? payload.message : 'SecondMe error';
        throw new Error(msg);
      }
      currentEvent = null;

      const choices = payload.choices as
        | { delta?: { content?: string } }[]
        | undefined;
      const delta = choices?.[0]?.delta?.content;
      if (typeof delta === 'string') output += delta;
      idx = buffer.indexOf('\n');
    }
  }

  return { sessionId, text: output };
}
