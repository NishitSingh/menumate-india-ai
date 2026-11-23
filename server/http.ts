// Adapts handlers to the Web-standard Request/Response used by Vercel functions.

import type { HandlerResult } from './handlers';
import type { AIEnv } from './ai';

const MAX_BODY_BYTES = 4_400_000;

export function env(): AIEnv {
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    AI_PROVIDER_ORDER: process.env.AI_PROVIDER_ORDER,
  };
}

export function json(r: HandlerResult): Response {
  return new Response(JSON.stringify(r.body), {
    status: r.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function readJson(req: Request): Promise<unknown | Response> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY_BYTES) {
    return json({ status: 413, body: { error: { code: 'BAD_REQUEST', message: 'Request too large', retryable: false } } });
  }
  try {
    return await req.json();
  } catch {
    return json({ status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Body must be JSON', retryable: false } } });
  }
}

export function post(handler: (body: unknown, env: AIEnv) => Promise<HandlerResult>) {
  return async (req: Request): Promise<Response> => {
    const body = await readJson(req);
    if (body instanceof Response) return body;
    return json(await handler(body, env()));
  };
}
