// Shared types and errors for the AI providers.

export class UpstreamError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public retryable: boolean,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

/** Reads a suggested wait, e.g. "retry in 17h2m44.5s", "try again in 7.66s" or "retryDelay": "61264s". */
export function parseRetrySeconds(detail: string): number | null {
  const m = detail.match(/(?:retry|try again) in\s+(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:([\d.]+)s)?/i);
  if (m && (m[1] || m[2] || m[3])) return Math.ceil(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0));
  const d = detail.match(/"retryDelay"\s*:\s*"([\d.]+)s"/);
  return d ? Math.ceil(Number(d[1])) : null;
}

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export interface CallOptions {
  system: string;
  parts: Part[];
  temperature?: number;
  timeoutMs?: number;
  /** Upper bound on output tokens. Groq counts it toward its per-minute token limit. */
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

/** Turns a fetch exception into a timeout or network error. */
export function networkError(e: unknown, provider: string): UpstreamError {
  const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
  return new UpstreamError(timeout ? 'TIMEOUT' : 'UPSTREAM_ERROR', timeout ? `${provider} timed out` : `Could not reach ${provider}`, 504, true);
}
