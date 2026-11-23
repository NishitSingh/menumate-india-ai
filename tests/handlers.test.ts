// Backend tests with a mocked Gemini API — no network or key required.
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { handleExtract, handleHealth, handleRecommend, handleTranslate } from '../server/handlers';
import { resetProviderCooldowns } from '../server/ai';

beforeEach(() => resetProviderCooldowns());

const env = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' };
const IMG = { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', mimeType: 'image/png' };

/** Builds a fake fetch that returns the given model outputs in order. */
function fakeGemini(...outputs: (string | { status: number })[]) {
  const calls: { url: string; body: any; headers: any }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string), headers: init.headers });
    const next = outputs.shift();
    if (next === undefined) throw new Error('unexpected extra call');
    if (typeof next !== 'string') return new Response('{"error":{"message":"secret details"}}', { status: next.status });
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: next }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

test('health never exposes the key', () => {
  const r = handleHealth(env);
  assert.deepEqual(r.body, { ok: true, configured: true, model: 'test-model', providers: [{ id: 'gemini', model: 'test-model' }] });
  assert.ok(!JSON.stringify(r.body).includes('test-key'));
  const both = handleHealth({ ...env, GROQ_API_KEY: 'groq-secret' }).body as any;
  assert.equal(both.model, 'test-model + backup qwen/qwen3.8-27b');
  assert.ok(!JSON.stringify(both).includes('groq-secret'));
  assert.equal((handleHealth({}).body as any).configured, false);
});

test('extract: not configured → 503 NOT_CONFIGURED', async () => {
  const r = await handleExtract(IMG, {});
  assert.equal(r.status, 503);
  assert.equal((r.body as any).error.code, 'NOT_CONFIGURED');
});

test('extract: input validation', async () => {
  assert.equal((await handleExtract({}, env)).status, 400);
  assert.equal((await handleExtract({ ...IMG, mimeType: 'image/gif' }, env)).status, 400);
  assert.equal((await handleExtract({ ...IMG, base64: 'A'.repeat(4_000_001) }, env)).status, 413);
});

test('extract: success, key sent as header (not URL), image sent inline', async () => {
  const { f, calls } = fakeGemini(
    JSON.stringify({ isMenu: true, detectedLanguage: 'Hindi', languageConfidence: 'high', items: [{ originalName: 'समोसा', price: 30, priceText: '₹30' }] }),
  );
  const r = await handleExtract({ ...IMG, sourceLanguageHint: null }, env, f);
  assert.equal(r.status, 200);
  const ex = (r.body as any).extraction;
  assert.equal(ex.items[0].originalName, 'समोसा');
  assert.equal(ex.items[0].price, 30);
  assert.ok(!calls[0].url.includes('test-key'));
  assert.equal(calls[0].headers['x-goog-api-key'], 'test-key');
  assert.equal(calls[0].body.contents[0].parts[0].inline_data.mime_type, 'image/png');
  assert.equal(calls[0].body.generationConfig.responseMimeType, 'application/json');
});

test('extract: malformed JSON is retried once, then succeeds', async () => {
  const { f, calls } = fakeGemini('Sorry, here is the menu: {broken', JSON.stringify({ isMenu: true, detectedLanguage: 'Tamil', items: [{ originalName: 'தோசை', price: null }] }));
  const r = await handleExtract(IMG, env, f);
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2);
  assert.equal((r.body as any).extraction.items[0].price, null);
});

test('extract: malformed twice → 502 MALFORMED_AI_RESPONSE (retryable)', async () => {
  const { f } = fakeGemini('nope', 'still nope');
  const r = await handleExtract(IMG, env, f);
  assert.equal(r.status, 502);
  assert.deepEqual((r.body as any).error, { code: 'MALFORMED_AI_RESPONSE', message: 'The AI response could not be validated', retryable: true });
});

test('extract: upstream 429 is not retried server-side and not leaked', async () => {
  const { f, calls } = fakeGemini({ status: 429 });
  const r = await handleExtract(IMG, env, f);
  assert.equal(r.status, 429);
  assert.equal(calls.length, 1);
  assert.ok(!JSON.stringify(r.body).includes('secret details'));
});

test('extract: 429 with "limit: 0" → MODEL_NOT_FREE (not retryable)', async () => {
  const calls: number[] = [];
  const f = (async () => {
    calls.push(1);
    return new Response('{"error":{"code":429,"message":"Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: x"}}', { status: 429 });
  }) as unknown as typeof fetch;
  const r = await handleExtract(IMG, env, f);
  assert.equal((r.body as any).error.code, 'MODEL_NOT_FREE');
  assert.equal((r.body as any).error.retryable, false);
  assert.equal(calls.length, 1);
});

test('extract: daily quota → DAILY_QUOTA with reset time, no retry', async () => {
  let n = 0;
  const body = '{"error":{"code":429,"message":"Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: m, description: Generate content requests per day limit exceeded on Free Tier.\\nPlease retry in 17h2m44.5s."}}';
  const f = (async () => (n++, new Response(body, { status: 429 }))) as unknown as typeof fetch;
  const r = await handleExtract(IMG, env, f);
  const e = (r.body as any).error;
  assert.equal(e.code, 'DAILY_QUOTA');
  assert.equal(e.retryable, false);
  assert.equal(e.retryAfterSeconds, 17 * 3600 + 2 * 60 + 45);
  assert.equal(n, 1);
});

test('extract: 503 overload is retried once server-side, then reported', async () => {
  let n = 0;
  const f = (async () => (n++, new Response('{"error":{"code":503,"status":"UNAVAILABLE"}}', { status: 503 }))) as unknown as typeof fetch;
  const r = await handleExtract(IMG, env, f);
  assert.equal((r.body as any).error.code, 'OVERLOADED');
  assert.equal(n, 2);
});

test('extract: bad API key → NOT_CONFIGURED', async () => {
  const { f } = fakeGemini({ status: 403 });
  const r = await handleExtract(IMG, env, f);
  assert.equal((r.body as any).error.code, 'NOT_CONFIGURED');
});

test('translate: validates target language and item limits', async () => {
  assert.equal((await handleTranslate({ items: [{ id: 'i1', originalName: 'x' }], targetLanguage: 'xx' }, env)).status, 400);
  const many = Array.from({ length: 41 }, (_, i) => ({ id: `i${i}`, originalName: 'x' }));
  assert.equal((await handleTranslate({ items: many, targetLanguage: 'en' }, env)).status, 400);
});

test('translate: never returns prices even if the model does', async () => {
  const { f, calls } = fakeGemini(JSON.stringify({ items: [{ id: 'i1', translatedName: 'Samosa', priceINR: 999, price: 999, foodCategory: 'Snacks', dietaryClassification: 'Vegetarian' }] }));
  const r = await handleTranslate({ sourceLanguage: 'Hindi', targetLanguage: 'fr', items: [{ id: 'i1', originalName: 'समोसा', priceText: '₹30' }] }, env, f);
  assert.equal(r.status, 200);
  const item = (r.body as any).items[0];
  assert.equal(item.translatedName, 'Samosa');
  assert.ok(!('price' in item) && !('priceINR' in item));
  assert.match(calls[0].body.contents[0].parts[0].text, /French/);
});

test('recommend: drops ids that are not on the menu', async () => {
  const { f } = fakeGemini(JSON.stringify({ recommendations: [{ id: 'ghost', reason: 'x' }, { id: 'i1', reason: 'Mild and vegetarian.' }] }));
  const r = await handleRecommend({ targetLanguage: 'en', preferences: { dietary: 'vegetarian' }, items: [{ id: 'i1', name: 'Idli' }] }, env, f);
  assert.deepEqual((r.body as any).recommendations.map((x: any) => x.itemId), ['i1']);
});

// ---------------------------------------------------------------------------
// Groq backup + fallback chain
// ---------------------------------------------------------------------------

const both = { ...env, GROQ_API_KEY: 'groq-key' };
const MENU_JSON = JSON.stringify({ isMenu: true, detectedLanguage: 'Hindi', languageConfidence: 'high', items: [{ originalName: 'समोसा', price: 30 }] });
const groqOk = (text: string) => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: text } }] }), { status: 200 });
const geminiOk = (text: string) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] }), { status: 200 });

/** Fake fetch that routes by host: each handler list is consumed in order. */
function router(gemini: (() => Response)[], groq: (() => Response)[]) {
  const log: { host: string; body: any; headers: any }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const host = url.includes('groq.com') ? 'groq' : 'gemini';
    log.push({ host, body: JSON.parse(init.body as string), headers: init.headers });
    const next = (host === 'groq' ? groq : gemini).shift();
    if (!next) throw new Error(`unexpected ${host} call`);
    return next();
  }) as unknown as typeof fetch;
  return { f, log };
}

test('groq only: OpenAI-style request with image data URL, JSON mode and Bearer key', async () => {
  const { f, log } = router([], [() => groqOk(MENU_JSON)]);
  const r = await handleExtract(IMG, { GROQ_API_KEY: 'groq-key' }, f);
  assert.equal(r.status, 200);
  assert.equal((r.body as any).model, 'Groq: qwen/qwen3.8-27b');
  const req = log[0];
  assert.equal(req.headers.Authorization, 'Bearer groq-key');
  assert.equal(req.body.response_format.type, 'json_object');
  assert.equal(req.body.messages[0].role, 'system');
  assert.match(req.body.messages[1].content[0].image_url.url, /^data:image\/png;base64,/);
});

test('fallback: Gemini daily quota → Groq answers, user sees success', async () => {
  const { f, log } = router(
    [() => new Response('{"error":{"message":"Generate content requests per day limit exceeded. Please retry in 5h1m2s."}}', { status: 429 })],
    [() => groqOk(MENU_JSON)],
  );
  const r = await handleExtract(IMG, both, f);
  assert.equal(r.status, 200);
  assert.equal((r.body as any).model, 'Groq: qwen/qwen3.8-27b');
  assert.deepEqual(log.map((l) => l.host), ['gemini', 'groq']);
});

test('fallback: Gemini 503 overload switches to Groq immediately (no wasted Gemini retry)', async () => {
  const { f, log } = router([() => new Response('{}', { status: 503 })], [() => groqOk(MENU_JSON)]);
  const r = await handleExtract(IMG, both, f);
  assert.equal(r.status, 200);
  assert.deepEqual(log.map((l) => l.host), ['gemini', 'groq']);
});

test('fallback: Gemini works → Groq never called', async () => {
  const { f, log } = router([() => geminiOk(MENU_JSON)], []);
  const r = await handleExtract(IMG, both, f);
  assert.equal((r.body as any).model, 'Gemini: test-model');
  assert.equal(log.length, 1);
});

test('both fail: per-minute Groq limit is reported as retryable with wait time', async () => {
  const groq429 = () =>
    new Response('{"error":{"message":"Rate limit reached for model on tokens per minute (TPM). Please try again in 7.66s."}}', {
      status: 429,
      headers: { 'retry-after': '8' },
    });
  const { f } = router([() => new Response('{"error":{"message":"requests per day limit exceeded, limit: 20"}}', { status: 429 })], [groq429]);
  const r = await handleExtract(IMG, both, f);
  const e = (r.body as any).error;
  assert.equal(e.code, 'RATE_LIMITED');
  assert.equal(e.retryable, true);
  assert.equal(e.retryAfterSeconds, 8);
});

test('both out of daily quota → DAILY_QUOTA (not retryable)', async () => {
  const { f } = router(
    [() => new Response('{"error":{"message":"requests per day limit exceeded, limit: 20. Please retry in 10h0m0s."}}', { status: 429 })],
    [() => new Response('{"error":{"message":"Rate limit reached on requests per day (RPD). Please try again in 2h0m0s."}}', { status: 429 })],
  );
  const e = ((await handleExtract(IMG, both, f)).body as any).error;
  assert.equal(e.code, 'DAILY_QUOTA');
  assert.equal(e.retryable, false);
  assert.equal(e.retryAfterSeconds, 7200); // soonest reset
});

test('groq json_validate_failed is retried once on Groq', async () => {
  const bad = () => new Response('{"error":{"code":"json_validate_failed","message":"Failed to generate JSON"}}', { status: 400 });
  const { f, log } = router([], [bad, () => groqOk(MENU_JSON)]);
  const r = await handleExtract(IMG, { GROQ_API_KEY: 'k' }, f);
  assert.equal(r.status, 200);
  assert.equal(log.length, 2);
});

test('groq <think> reasoning before the JSON is ignored', async () => {
  const { f } = router([], [() => groqOk(`<think>The menu has {braces} in reasoning</think>\n${MENU_JSON}`)]);
  const r = await handleExtract(IMG, { GROQ_API_KEY: 'k' }, f);
  assert.equal((r.body as any).extraction.items[0].originalName, 'समोसा');
});

test('AI_PROVIDER_ORDER=groq,gemini tries Groq first', async () => {
  const { f, log } = router([], [() => groqOk(MENU_JSON)]);
  await handleExtract(IMG, { ...both, AI_PROVIDER_ORDER: 'groq,gemini' }, f);
  assert.equal(log[0].host, 'groq');
});

test('translate via Groq still never returns prices', async () => {
  const { f } = router([], [() => groqOk(JSON.stringify({ items: [{ id: 'i1', translatedName: 'Samosa', priceINR: 999 }] }))]);
  const r = await handleTranslate({ sourceLanguage: 'Hindi', targetLanguage: 'en', items: [{ id: 'i1', originalName: 'समोसा' }] }, { GROQ_API_KEY: 'k' }, f);
  assert.ok(!('priceINR' in (r.body as any).items[0]));
});

test('daily-quota provider is skipped on the next request (no wasted call)', async () => {
  const gem429 = () => new Response('{"error":{"message":"requests per day limit exceeded, limit: 20. Please retry in 3h0m0s."}}', { status: 429 });
  const { f, log } = router([gem429], [() => groqOk(MENU_JSON), () => groqOk(MENU_JSON)]);
  await handleExtract(IMG, both, f);
  await handleExtract(IMG, both, f);
  assert.deepEqual(log.map((l) => l.host), ['gemini', 'groq', 'groq']);
});

test('translate asks Groq for only the output tokens a batch needs', async () => {
  const { f, log } = router([], [() => groqOk(JSON.stringify({ items: [{ id: 'i1', translatedName: 'Samosa' }] }))]);
  await handleTranslate({ sourceLanguage: 'Hindi', targetLanguage: 'en', items: [{ id: 'i1', originalName: 'समोसा' }] }, { GROQ_API_KEY: 'k' }, f);
  assert.equal(log[0].body.max_completion_tokens, 700);
});
