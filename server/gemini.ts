// Google Gemini provider (REST generateContent). Runs only on the server.

import { MalformedAIResponse } from '../src/lib/validate';
import { UpstreamError, networkError, parseRetrySeconds, type CallOptions } from './errors';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';

export function geminiModel(env: { GEMINI_MODEL?: string }) {
  return env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
}

export async function geminiCall(apiKey: string, model: string, o: CallOptions): Promise<string> {
  const f = o.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let res: Response;
  try {
    res = await f(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: o.system }] },
        contents: [{ role: 'user', parts: o.parts }],
        generationConfig: { temperature: o.temperature ?? 0.1, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(o.timeoutMs ?? 55_000),
    });
  } catch (e) {
    throw networkError(e, 'Gemini');
  }

  if (!res.ok) {
    // Never forward Google's raw error body to the browser: it can echo request details.
    // Log it on the server only (terminal / Vercel logs) so the real cause is visible.
    const detail = (await res.text().catch(() => '')).slice(0, 1500);
    console.error(`[gemini] ${res.status} from model "${model}": ${detail}`);
    if (res.status === 429) {
      // "limit: 0" means this model has no free-tier quota at all — waiting won't help.
      if (/limit:\s*0\b/.test(detail)) throw new UpstreamError('MODEL_NOT_FREE', `Model "${model}" has no free-tier quota`, 429, false);
      const wait = parseRetrySeconds(detail);
      if (/per ?day|PerDay/i.test(detail)) throw new UpstreamError('DAILY_QUOTA', `Daily free quota for "${model}" is used up`, 429, false, wait);
      throw new UpstreamError('RATE_LIMITED', 'Gemini rate limit reached', 429, true, wait);
    }
    if (res.status === 503) throw new UpstreamError('OVERLOADED', 'Gemini is overloaded right now', 503, true);
    if (res.status === 400) throw new UpstreamError('BAD_REQUEST', 'Gemini rejected the request', 400, false);
    if (res.status === 401 || res.status === 403) throw new UpstreamError('NOT_CONFIGURED', 'Gemini API key was rejected', 503, false);
    if (res.status === 404) throw new UpstreamError('NOT_CONFIGURED', `Model "${model}" is not available`, 503, false);
    throw new UpstreamError('UPSTREAM_ERROR', `Gemini error ${res.status}`, 502, res.status >= 500);
  }

  const json = (await res.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  if (json.promptFeedback?.blockReason) throw new UpstreamError('BLOCKED', 'Request was blocked by Gemini safety filters', 422, false);
  const cand = json.candidates?.[0];
  if (!cand) throw new MalformedAIResponse('No candidates returned');
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    throw new UpstreamError('BLOCKED', 'Response was blocked by Gemini safety filters', 422, false);
  }
  const text = (cand.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  if (cand.finishReason === 'MAX_TOKENS' && !text.trim().endsWith('}')) throw new MalformedAIResponse('Response was cut off (too long)');
  return text;
}
