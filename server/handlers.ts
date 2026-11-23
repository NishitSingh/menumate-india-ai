// Platform-neutral request handlers. Each takes a parsed JSON body and the
// environment, and returns { status, body }. The api/*.ts files adapt them to
// Vercel; vite.config.ts adapts them for local development.

import { TARGET_LANGUAGES, SOURCE_LANGUAGES, isTargetCode } from '../src/lib/languages';
import {
  MalformedAIResponse,
  validateExplanation,
  validateExtraction,
  validateRecommendations,
  validateTranslation,
} from '../src/lib/validate';
import type { ExtractedItem } from '../src/lib/types';
import { callAIJSON, describeProviders, providers, type AIEnv } from './ai';
import { UpstreamError } from './errors';
import * as P from './prompts';

export interface HandlerResult {
  status: number;
  body: unknown;
}

const MAX_IMAGE_BASE64 = 4_000_000; // ≈3 MB of image data; keeps under serverless body limits
const MAX_ITEMS_PER_CALL = 40;
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const err = (status: number, code: string, message: string, retryable = false): HandlerResult => ({
  status,
  body: { error: { code, message, retryable } },
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);

function knownSource(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const hit = SOURCE_LANGUAGES.find((l) => l.name.toLowerCase() === name.toLowerCase());
  return hit?.name ?? (/^[A-Za-z][A-Za-z \-]{1,30}$/.test(name) ? name : null);
}

function targetLabel(code: string) {
  const t = TARGET_LANGUAGES.find((l) => l.code === code)!;
  return `${t.name} (${t.native})`;
}

function mapError(e: unknown): HandlerResult {
  if (e instanceof UpstreamError) {
    const r = err(e.status, e.code, e.message, e.retryable);
    if (e.retryAfterSeconds !== null) (r.body as { error: Record<string, unknown> }).error.retryAfterSeconds = e.retryAfterSeconds;
    return r;
  }
  if (e instanceof MalformedAIResponse) return err(502, 'MALFORMED_AI_RESPONSE', 'The AI response could not be validated', true);
  return err(500, 'INTERNAL', 'Unexpected server error', true);
}

function requireKey(env: AIEnv): HandlerResult | null {
  return providers(env).length ? null : err(503, 'NOT_CONFIGURED', 'Neither GEMINI_API_KEY nor GROQ_API_KEY is set on the server');
}

/** Reports which providers are configured — never the keys themselves. */
export function handleHealth(env: AIEnv): HandlerResult {
  const p = providers(env);
  return {
    status: 200,
    body: { ok: true, configured: p.length > 0, model: describeProviders(env), providers: p.map((x) => ({ id: x.id, model: x.model })) },
  };
}

/** Operation 1: OCR + language detection. */
export async function handleExtract(body: unknown, env: AIEnv, fetchImpl?: typeof fetch): Promise<HandlerResult> {
  const missing = requireKey(env);
  if (missing) return missing;
  if (!isObj(body)) return err(400, 'BAD_REQUEST', 'Expected a JSON body');
  const base64 = typeof body.base64 === 'string' ? body.base64 : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
  if (!base64) return err(400, 'BAD_REQUEST', 'No image was provided');
  if (!IMAGE_MIME.includes(mimeType)) return err(400, 'BAD_REQUEST', 'Unsupported image type');
  if (base64.length > MAX_IMAGE_BASE64) return err(413, 'BAD_REQUEST', 'Image is too large');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64.slice(-100))) return err(400, 'BAD_REQUEST', 'Image data is not valid base64');
  const hint = knownSource(body.sourceLanguageHint);

  try {
    const { data, provider } = await callAIJSON(
      env,
      {
        system: P.EXTRACT_SYSTEM,
        parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: P.extractUserPrompt(hint) }],
        temperature: 0,
        maxOutputTokens: 6000,
        fetchImpl,
      },
      validateExtraction,
    );
    return { status: 200, body: { extraction: data.result, model: `${provider.label}: ${provider.model}` } };
  } catch (e) {
    return mapError(e);
  }
}

/** Operations 2 + 3: translation + dish intelligence. Prices are never sent back. */
export async function handleTranslate(body: unknown, env: AIEnv, fetchImpl?: typeof fetch): Promise<HandlerResult> {
  const missing = requireKey(env);
  if (missing) return missing;
  if (!isObj(body) || !Array.isArray(body.items)) return err(400, 'BAD_REQUEST', 'Expected items');
  if (!isTargetCode(body.targetLanguage)) return err(400, 'BAD_REQUEST', 'Unsupported target language');
  const source = knownSource(body.sourceLanguage) ?? 'Unknown';
  if (body.items.length === 0) return { status: 200, body: { items: [] } };
  if (body.items.length > MAX_ITEMS_PER_CALL) return err(400, 'BAD_REQUEST', `Send at most ${MAX_ITEMS_PER_CALL} items per request`);

  const originals: ExtractedItem[] = [];
  for (const [i, r] of body.items.entries()) {
    if (!isObj(r)) return err(400, 'BAD_REQUEST', 'Invalid item');
    const id = s(r.id, 20);
    const name = s(r.originalName, 160);
    if (!id || !name) return err(400, 'BAD_REQUEST', 'Each item needs an id and originalName');
    originals.push({
      id,
      order: i,
      originalName: name,
      transliteration: s(r.transliteration, 160),
      originalCategory: s(r.originalCategory, 80),
      priceText: s(r.priceText, 60),
      price: null,
      priceConfidence: 'low',
      nameConfidence: 'medium',
      needsReview: false,
      reviewNote: null,
    });
  }

  try {
    const { data: items } = await callAIJSON(
      env,
      {
        system: P.TRANSLATE_SYSTEM,
        parts: [
          {
            text: P.translateUserPrompt(
              source,
              targetLabel(body.targetLanguage),
              originals.map((o) => ({ id: o.id, originalName: o.originalName, pronunciation: o.transliteration, menuSection: o.originalCategory, priceText: o.priceText })),
            ),
          },
        ],
        temperature: 0.2,
        // ~300 tokens per dish is plenty; asking for less keeps Groq's per-minute budget free.
        maxOutputTokens: Math.min(4000, 300 * originals.length + 400),
        fetchImpl,
      },
      (raw) => validateTranslation(raw, originals),
    );
    return { status: 200, body: { items } };
  } catch (e) {
    return mapError(e);
  }
}

export async function handleExplain(body: unknown, env: AIEnv, fetchImpl?: typeof fetch): Promise<HandlerResult> {
  const missing = requireKey(env);
  if (missing) return missing;
  if (!isObj(body) || !isObj(body.dish) || !isTargetCode(body.targetLanguage)) return err(400, 'BAD_REQUEST', 'Expected dish and targetLanguage');
  const d = body.dish;
  const dish = {
    originalName: s(d.originalName, 160),
    translatedName: s(d.translatedName, 160),
    description: s(d.description, 500),
    cuisine: s(d.cuisine, 60),
  };
  if (!dish.originalName) return err(400, 'BAD_REQUEST', 'Dish needs an originalName');
  try {
    const { data: explanation } = await callAIJSON(
      env,
      {
        system: P.EXPLAIN_SYSTEM,
        parts: [{ text: P.explainUserPrompt(targetLabel(body.targetLanguage), knownSource(body.sourceLanguage) ?? 'Unknown', dish) }],
        temperature: 0.3,
        maxOutputTokens: 1000,
        fetchImpl,
      },
      validateExplanation,
    );
    return { status: 200, body: { explanation } };
  } catch (e) {
    return mapError(e);
  }
}

/** Operation 4: up to three suggestions, restricted to ids that exist on the menu. */
export async function handleRecommend(body: unknown, env: AIEnv, fetchImpl?: typeof fetch): Promise<HandlerResult> {
  const missing = requireKey(env);
  if (missing) return missing;
  if (!isObj(body) || !Array.isArray(body.items) || !isTargetCode(body.targetLanguage)) return err(400, 'BAD_REQUEST', 'Expected items and targetLanguage');
  if (body.items.length > 150) return err(400, 'BAD_REQUEST', 'Too many items');
  const p = isObj(body.preferences) ? body.preferences : {};
  const preferences = {
    dietary: ['none', 'vegetarian', 'vegan', 'dairy-free'].includes(p.dietary as string) ? p.dietary : 'none',
    spice: ['none', 'mild', 'medium', 'spicy'].includes(p.spice as string) ? p.spice : 'none',
    avoidIngredients: Array.isArray(p.avoid) ? p.avoid.map((a) => s(a, 40)).filter(Boolean).slice(0, 20) : [],
  };
  const items = body.items.filter(isObj).map((i) => ({
    id: s(i.id, 20),
    name: s(i.name, 160),
    originalName: s(i.originalName, 160),
    category: s(i.category, 30),
    spiceLevel: s(i.spiceLevel, 20),
    dietaryClassification: s(i.dietaryClassification, 20),
    dietaryConfidence: s(i.dietaryConfidence, 10),
    ingredients: Array.isArray(i.ingredients) ? i.ingredients.map((x) => s(x, 60)).slice(0, 20) : [],
    allergenWarnings: Array.isArray(i.allergenWarnings) ? i.allergenWarnings.map((x) => s(x, 200)).slice(0, 10) : [],
  }));
  const ids = new Set(items.map((i) => i.id).filter((x): x is string => !!x));
  try {
    const { data: recommendations } = await callAIJSON(
      env,
      {
        system: P.RECOMMEND_SYSTEM,
        parts: [{ text: P.recommendUserPrompt(targetLabel(body.targetLanguage), preferences, items) }],
        temperature: 0.3,
        maxOutputTokens: 800,
        fetchImpl,
      },
      (raw) => validateRecommendations(raw, ids),
    );
    return { status: 200, body: { recommendations } };
  } catch (e) {
    return mapError(e);
  }
}

export const ROUTES: Record<string, (body: unknown, env: AIEnv) => Promise<HandlerResult>> = {
  extract: handleExtract,
  translate: handleTranslate,
  explain: handleExplain,
  recommend: handleRecommend,
};
