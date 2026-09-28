import { Injectable } from '@nestjs/common';

/** Optional outbound provider; failures leave the local description pass available. */
@Injectable()
export class DescriptionAiService {
  async improve(text: string): Promise<string | null> {
    if (process.env.AI_ENABLED !== 'true') return null;
    const key = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL;
    if (!key || !model) return null;
    const endpoint =
      process.env.GROQ_ENDPOINT ?? 'https://api.groq.com/openai/v1';
    let url: URL;
    try {
      url = new URL(`${endpoint.replace(/\/$/, '')}/chat/completions`);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || url.hostname !== 'api.groq.com')
      return null;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Improve this task description for grammar, clarity, professionalism, and specific action. Return only the improved description.\n\n${text}`,
            },
          ],
          model,
          temperature: 0.7,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return null;
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') return null;
      const choices = (payload as Record<string, unknown>).choices;
      if (!Array.isArray(choices) || choices.length === 0) return null;
      const first: unknown = choices[0];
      if (!first || typeof first !== 'object') return null;
      const message = (first as Record<string, unknown>).message;
      if (!message || typeof message !== 'object') return null;
      const content = (message as Record<string, unknown>).content;
      return typeof content === 'string' && content.trim()
        ? content.trim()
        : null;
    } catch {
      return null;
    }
  }
}
