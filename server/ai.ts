// Provider chain: tries Gemini first, then Groq as an automatic backup.
// If the first provider is busy, out of quota or returns unusable output,
// the same request goes to the next one. The user only sees an error if all fail.

import { MalformedAIResponse, parseJsonLoose } from '../src/lib/validate';
import { UpstreamError, type CallOptions } from './errors';
import { geminiCall, geminiModel } from './gemini';
import { groqCall, groqModel } from './groq';

export interface AIEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  /** Optional: "groq,gemini" to try Groq first. Default "gemini,groq". */
  AI_PROVIDER_ORDER?: string;
}

export interface Provider {
  id: 'gemini' | 'groq';
  label: string;
  model: string;
  call: (o: CallOptions) => Promise<string>;
}

// Providers whose DAILY quota is used up are skipped until their reset, so each request
// doesn't waste time (and log noise) asking them first. In-memory, per server instance.
const cooldownUntil = new Map<string, number>();
const cooldownKey = (p: Provider) => `${p.id}:${p.model}`;

export function resetProviderCooldowns() {
  cooldownUntil.clear();
}

export function providers(env: AIEnv): Provider[] {
  const all: Provider[] = [];
  const gKey = env.GEMINI_API_KEY?.trim();
  const qKey = env.GROQ_API_KEY?.trim();
  if (gKey) all.push({ id: 'gemini', label: 'Gemini', model: geminiModel(env), call: (o) => geminiCall(gKey, geminiModel(env), o) });
  if (qKey) all.push({ id: 'groq', label: 'Groq', model: groqModel(env), call: (o) => groqCall(qKey, groqModel(env), o) });
  const order = (env.AI_PROVIDER_ORDER ?? 'gemini,groq').toLowerCase().split(',').map((s) => s.trim());
  return all.sort((a, b) => (order.indexOf(a.id) + 99) % 99 - ((order.indexOf(b.id) + 99) % 99));
}

/** Human-readable summary for /api/health, e.g. "gemini-3.8-flash + backup qwen/qwen3.8-27b". */
export function describeProviders(env: AIEnv): string | null {
  const p = providers(env);
  if (!p.length) return null;
  return p.map((x, i) => (i === 0 ? x.model : `backup ${x.model}`)).join(' + ');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = new Set(['OVERLOADED', 'UPSTREAM_ERROR', 'TIMEOUT']);
const TOTAL_BUDGET_MS = 55_000; // stay under the 60s serverless limit
const FIRST_PROVIDER_MAX_MS = 35_000; // leave time for the backup

export interface AIResult<T> {
  data: T;
  provider: Provider;
}

/**
 * Runs the request through the provider chain and validates the JSON.
 * - Malformed output: retried once on the same provider, then the next provider.
 * - Busy / quota / key / model errors: go straight to the next provider (no wasted retries).
 * - Last provider busy: one retry after 3 s.
 */
export async function callAIJSON<T>(env: AIEnv, o: CallOptions, validate: (raw: unknown) => T): Promise<AIResult<T>> {
  const all = providers(env);
  if (!all.length) throw new UpstreamError('NOT_CONFIGURED', 'No AI API key is set on the server', 503, false);
  const now = Date.now();
  const available = all.filter((p) => (cooldownUntil.get(cooldownKey(p)) ?? 0) <= now);
  // If every provider is cooling down, try them anyway: the quota may have reset early.
  const chain = available.length ? available : all;
  const start = Date.now();
  const errors: unknown[] = [];

  for (let i = 0; i < chain.length; i++) {
    const p = chain[i];
    const isLast = i === chain.length - 1;
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
      if (remaining < 5_000) break;
      try {
        const text = await p.call({ ...o, timeoutMs: Math.min(remaining, isLast ? remaining : FIRST_PROVIDER_MAX_MS) });
        return { data: validate(parseJsonLoose(text)), provider: p };
      } catch (e) {
        if (attempt === 0) errors.push(e);
        else errors[errors.length - 1] = e;
        if (e instanceof UpstreamError && e.code === 'DAILY_QUOTA' && chain.length > 1) {
          const seconds = Math.min(e.retryAfterSeconds ?? 3600, 24 * 3600);
          cooldownUntil.set(cooldownKey(p), Date.now() + seconds * 1000);
          console.warn(`[ai] ${p.label} daily quota used up — skipping it for ${Math.round(seconds / 60)} min`);
        }
        const code = e instanceof UpstreamError ? e.code : e instanceof MalformedAIResponse ? 'MALFORMED' : 'INTERNAL';
        const retrySame = attempt === 0 && (code === 'MALFORMED' || (isLast && TRANSIENT.has(code)));
        if (retrySame) {
          await sleep(code === 'MALFORMED' ? 500 : 3000);
          continue;
        }
        if (!isLast) console.warn(`[ai] ${p.label} failed (${code}); switching to ${chain[i + 1].label}`);
        break;
      }
    }
  }

  // All providers failed. Prefer an error the user can fix by waiting a moment.
  const upstream = errors.filter((e): e is UpstreamError => e instanceof UpstreamError);
  const retryable = upstream.find((e) => e.retryable);
  if (retryable) throw retryable;
  if (errors.some((e) => e instanceof MalformedAIResponse) && !upstream.length) throw errors[errors.length - 1];
  const daily = upstream.find((e) => e.code === 'DAILY_QUOTA');
  if (daily) {
    // Report the soonest reset among the providers.
    const waits = upstream.map((e) => e.retryAfterSeconds).filter((w): w is number => w !== null);
    daily.retryAfterSeconds = waits.length ? Math.min(...waits) : daily.retryAfterSeconds;
    throw daily;
  }
  throw errors[0];
}
