import { z } from 'zod';

export const MAX_PROMPT_CHARS = 4_000;
export const MAX_HISTORY_CHARS = 8_000;
export const MAX_RESPONSE_CHARS = 16_000;
export const CHAT_TIMEOUT_MS = 60_000;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const streamPacket = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string().max(MAX_RESPONSE_CHARS) }).strict(),
  z.object({ type: z.literal('done'), model: z.string().min(1) }).strict(),
  z.object({ type: z.literal('error'), error: z.string().min(1) }).strict(),
]);
export type StreamPacket = z.infer<typeof streamPacket>;

// Keep the transcript on screen, but send only recent complete pairs that fit.
export function recentHistory(messages: ChatMessage[]): ChatMessage[] {
  const history: ChatMessage[] = [];
  let size = 0;
  for (let index = messages.length - 2; index >= 0; index -= 2) {
    const user = messages[index];
    const assistant = messages[index + 1];
    const pairSize = user.content.length + assistant.content.length;
    if (user.role !== 'user' || assistant.role !== 'assistant' ||
        !user.content.trim() || !assistant.content.trim() ||
        size + pairSize > MAX_HISTORY_CHARS || history.length === 12) break;
    history.unshift(user, assistant);
    size += pairSize;
  }
  return history;
}

export const chatInput = z.object({
  prompt: z.string().trim().min(1, 'Enter a prompt for Gemma.').max(MAX_PROMPT_CHARS),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(MAX_HISTORY_CHARS),
  }).strict()).max(12).default([]),
}).strict().superRefine(({ history }, ctx) => {
  if (history.length % 2 || history.some((item, index) => item.role !== (index % 2 ? 'assistant' : 'user'))) {
    ctx.addIssue({ code: 'custom', path: ['history'], message: 'History must contain complete user/assistant pairs.' });
  }
  if (history.reduce((sum, item) => sum + item.content.length, 0) > MAX_HISTORY_CHARS) {
    ctx.addIssue({ code: 'custom', path: ['history'], message: 'Conversation context is too large.' });
  }
});

// Ollama sends newline-delimited JSON. This parser handles split UTF-8 chunks,
// split lines, CRLF, and a final line without a newline while bounding a line.
export async function* jsonLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        if (newline > 64_000) throw new Error('Response line is too large.');
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) yield JSON.parse(line);
      }
      if (buffer.length > 64_000) throw new Error('Response line is too large.');
      if (done) break;
    }
    if (buffer.trim()) yield JSON.parse(buffer);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
