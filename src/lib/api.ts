// Browser-side client for the serverless API. The browser never sees the Gemini key:
// it only talks to /api/* on the same origin.

import type {
  DishExplanation,
  ExtractedItem,
  ExtractionResult,
  MenuItem,
  Recommendation,
  TargetLanguageCode,
  TranslatedItem,
  UserPreferences,
} from './types';
import { validateExplanation, validateExtraction, validateRecommendations, validateTranslation } from './validate';

export interface BackendStatus {
  reachable: boolean;
  configured: boolean;
  model: string | null;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

function resetTimeText(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return 'It resets daily at midnight US Pacific time.';
  const at = new Date(Date.now() + seconds * 1000);
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const sameDay = at.toDateString() === new Date().toDateString();
  return `It resets at about ${time}${sameDay ? '' : ' tomorrow'} (your time).`;
}

const FRIENDLY: Record<string, string> = {
  NETWORK: 'We couldn’t reach the translation service. Check your connection and try again.',
  NOT_CONFIGURED: 'Live AI translation isn’t set up on this site yet. You can still explore the sample menu.',
  RATE_LIMITED: 'The free AI quota is busy right now. Please wait a minute and try again.',
  OVERLOADED: 'Google’s AI is very busy right now. This is usually temporary — please try again in a minute or two.',
  MODEL_NOT_FREE:
    'The AI model set on the server has no free quota. The site owner needs to set GEMINI_MODEL to a model that is free in Google AI Studio.',
  TIMEOUT: 'The AI took too long to respond. Please try again.',
  MALFORMED_AI_RESPONSE: 'The AI returned a response we couldn’t read safely. Trying again usually fixes this.',
  UPSTREAM_ERROR: 'The AI service had a problem. Please try again.',
  BLOCKED: 'The AI declined to process this image. Try a clearer photo of just the menu.',
  BAD_REQUEST: 'Something about this request wasn’t valid. Please try a different photo.',
};

export function friendlyMessage(code: string, fallback?: string) {
  return FRIENDLY[code] ?? fallback ?? 'Something went wrong. Please try again.';
}

export async function checkBackend(timeoutMs = 4000): Promise<BackendStatus> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { reachable: false, configured: false, model: null };
    const j = (await res.json()) as { configured?: boolean; model?: string };
    return { reachable: true, configured: j.configured === true, model: j.model ?? null };
  } catch {
    return { reachable: false, configured: false, model: null };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST JSON with one automatic retry for transient failures (network, 429, 5xx). */
async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let lastErr: ApiError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(1500);
    if (signal?.aborted) throw new ApiError('ABORTED', 'Cancelled', false);
    let res: Response;
    try {
      res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (signal?.aborted) throw new ApiError('ABORTED', 'Cancelled', false);
      lastErr = new ApiError('NETWORK', friendlyMessage('NETWORK'), true);
      continue;
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON error page */
    }
    if (res.ok) return json as T;
    const err = (json as { error?: { code?: string; message?: string; retryable?: boolean; retryAfterSeconds?: number } } | null)?.error;
    const code = err?.code ?? (res.status === 429 ? 'RATE_LIMITED' : res.status >= 500 ? 'UPSTREAM_ERROR' : 'BAD_REQUEST');
    const retryable = err?.retryable ?? (res.status === 429 || res.status >= 500);
    const message =
      code === 'DAILY_QUOTA'
        ? `Today’s free AI limit on this site has been used up. ${resetTimeText(err?.retryAfterSeconds)} The sample menu still works.`
        : friendlyMessage(code, err?.message);
    lastErr = new ApiError(code, message, retryable, typeof err?.retryAfterSeconds === 'number' ? err.retryAfterSeconds : null);
    // The server already retried once where useful. Retrying again here would only spend more
    // of the free daily quota, so the browser retries network failures only.
    break;
  }
  throw lastErr ?? new ApiError('UPSTREAM_ERROR', friendlyMessage('UPSTREAM_ERROR'), true);
}

/** Operation 1: OCR + language detection. Response is re-validated in the browser. */
export async function extractMenu(
  image: { base64: string; mimeType: string },
  sourceLanguageHint: string | null,
  signal?: AbortSignal,
): Promise<{ extraction: ExtractionResult; model: string | null }> {
  const j = await post<{ extraction: unknown; model?: string }>('/api/extract', { ...image, sourceLanguageHint }, signal);
  return { extraction: validateExtraction(j.extraction).result, model: j.model ?? null };
}

/** Operations 2 + 3: translation and dish intelligence for one batch of items. */
export async function translateItems(
  items: ExtractedItem[],
  sourceLanguage: string,
  targetLanguage: TargetLanguageCode,
  signal?: AbortSignal,
): Promise<TranslatedItem[]> {
  const j = await post<{ items: unknown }>(
    '/api/translate',
    {
      sourceLanguage,
      targetLanguage,
      items: items.map((i) => ({ id: i.id, originalName: i.originalName, transliteration: i.transliteration ?? null, originalCategory: i.originalCategory, priceText: i.priceText })),
    },
    signal,
  );
  return validateTranslation({ items: j.items }, items);
}

export async function explainDish(item: MenuItem, sourceLanguage: string, targetLanguage: TargetLanguageCode): Promise<DishExplanation> {
  const j = await post<{ explanation: unknown }>('/api/explain', {
    sourceLanguage,
    targetLanguage,
    dish: {
      originalName: item.originalName,
      translatedName: item.translatedName,
      description: item.description,
      cuisine: item.cuisine,
    },
  });
  return validateExplanation(j.explanation);
}

export async function recommendDishes(items: MenuItem[], prefs: UserPreferences, targetLanguage: TargetLanguageCode): Promise<Recommendation[]> {
  const j = await post<{ recommendations: unknown }>('/api/recommend', {
    targetLanguage,
    preferences: { dietary: prefs.dietary, spice: prefs.spice, avoid: prefs.avoid },
    items: items.map((i) => ({
      id: i.id,
      name: i.translatedName,
      originalName: i.originalName,
      category: i.foodCategory,
      spiceLevel: i.spiceLevel,
      dietaryClassification: i.dietaryClassification,
      dietaryConfidence: i.dietaryConfidence,
      ingredients: i.ingredients.map((x) => x.name),
      allergenWarnings: i.allergenWarnings,
    })),
  });
  return validateRecommendations({ recommendations: j.recommendations }, new Set(items.map((i) => i.id)));
}
