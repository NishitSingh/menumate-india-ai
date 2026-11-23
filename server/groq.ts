// Groq provider (OpenAI-compatible chat completions). Used as the automatic backup.
// Docs: https://console.groq.com/docs/vision — images are sent as base64 data URLs.

import { MalformedAIResponse } from '../src/lib/validate';
import { UpstreamError, networkError, parseRetrySeconds, type CallOptions } from './errors';

export const GROQ_DEFAULT_MODEL = 'qwen/qwen3.8-27b';

export function groqModel(env: { GROQ_MODEL?: string }) {
  return env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL;
}

export async function groqCall(apiKey: string, model: string, o: CallOptions): Promise<string> {
  const f = o.fetchImpl ?? fetch;
  const content = o.parts.map((p) =>
    'text' in p
      ? { type: 'text', text: p.text }
      : { type: 'image_url', image_url: { url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}` } },
  );
  const send = (jsonMode: boolean) =>
    f('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: o.system },
          { role: 'user', content },
        ],
        temperature: o.temperature ?? 0.1,
        // Kept to what the request needs: Groq counts this toward its per-minute token limit.
        max_completion_tokens: o.maxOutputTokens ?? 4000,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(o.timeoutMs ?? 55_000),
    });

  let res: Response;
  try {
    res = await send(true);
  } catch (e) {
    throw networkError(e, 'Groq');
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 1500);
    console.error(`[groq] ${res.status} from model "${model}": ${detail}`);
    // Model produced text that failed Groq's own JSON check → treat as malformed (retried once).
    if (res.status === 400 && /json_validate_failed/i.test(detail)) throw new MalformedAIResponse('Groq output was not valid JSON');
    if (res.status === 429) {
      const header = res.headers.get('retry-after');
      const wait = (header && Number.isFinite(Number(header)) ? Number(header) : null) ?? parseRetrySeconds(detail);
      if (/per day|\(RPD\)|\(TPD\)|requests per day|tokens per day/i.test(detail)) {
        throw new UpstreamError('DAILY_QUOTA', `Daily free quota for Groq "${model}" is used up`, 429, false, wait || null);
      }
      throw new UpstreamError('RATE_LIMITED', 'Groq rate limit reached', 429, true, wait || null);
    }
    if (res.status === 413) throw new UpstreamError('BAD_REQUEST', 'Request too large for Groq', 413, false);
    if (res.status === 401 || res.status === 403) throw new UpstreamError('NOT_CONFIGURED', 'Groq API key was rejected', 503, false);
    if (res.status === 404 || /model_not_found|decommissioned|does not exist/i.test(detail)) {
      throw new UpstreamError('NOT_CONFIGURED', `Groq model "${model}" is not available`, 503, false);
    }
    if (res.status === 400) throw new UpstreamError('BAD_REQUEST', 'Groq rejected the request', 400, false);
    if (res.status === 503 || res.status === 498) throw new UpstreamError('OVERLOADED', 'Groq is over capacity right now', 503, true);
    throw new UpstreamError('UPSTREAM_ERROR', `Groq error ${res.status}`, 502, res.status >= 500);
  }

  const json = (await res.json()) as { choices?: { finish_reason?: string; message?: { content?: string | null } }[] };
  const choice = json.choices?.[0];
  const text = choice?.message?.content ?? '';
  if (!text) throw new MalformedAIResponse('Groq returned no content');
  if (choice?.finish_reason === 'length' && !text.trim().endsWith('}')) throw new MalformedAIResponse('Groq response was cut off');
  return text;
}
