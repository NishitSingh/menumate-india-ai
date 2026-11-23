# Testing checklist

Two automated layers, plus a manual checklist for things that need a real device or a real API key.

## 1. Unit + backend tests — `npm test` (38 tests, all passing)

`tests/validate.test.ts`
- JSON parsing: code fences, leading prose, garbage, empty → `MalformedAIResponse`
- Price parsing: `₹120`, `Rs. 1,250/-`, decimals; ambiguous (`90 / 160`), negative, absurd, NaN → `null`
- Extraction keeps each dish's pronunciation (transliteration) for the dish picker
- Extraction: missing prices stay `null`; unreadable lines dropped and counted; order preserved; unknown language → low confidence; no items → not a menu
- Translation: vegetarian + chicken → Unknown; vegan + butter → Vegetarian; missing items → untranslated fallback; invented ids ignored; bad enums normalised; model-supplied prices discarded; safety claims stripped; empty response → malformed
- Recommendations: only menu ids, max 3, no duplicates
- Preference matching: non-veg flagged for vegetarians; paneer flagged for vegans; “nuts” catches cashew paste; rule-based suggestions exclude conflicts
- Sample menu: 6 dishes, exact prices from the brief, all 5 languages, labelled demo

`tests/handlers.test.ts` (mocked Gemini, no network)
- `/api/health` never contains the key
- No key → 503 `NOT_CONFIGURED`
- Input validation: missing image, wrong MIME type, oversized image, bad target language, too many items
- Key sent in `x-goog-api-key` header, never in the URL; image sent inline; JSON mode requested
- Malformed output retried once then succeeds; malformed twice → 502 `MALFORMED_AI_RESPONSE` (retryable)
- Upstream 429 not retried server-side and Google’s error body not leaked; 403 → `NOT_CONFIGURED`
- Translate never returns prices; target language passed to the prompt
- Recommend drops ids not on the menu
- Daily quota → `DAILY_QUOTA` with parsed reset time; `limit: 0` → `MODEL_NOT_FREE`; 503 retried once then `OVERLOADED`

`tests/handlers.test.ts` — Groq backup
- Groq request format: Bearer key, system message, image as data URL, JSON mode
- Gemini daily quota → Groq answers; Gemini 503 → Groq immediately (no wasted retry); Gemini OK → Groq never called
- Both fail: per-minute limit → retryable with wait time; both daily → `DAILY_QUOTA` with soonest reset
- Groq `json_validate_failed` retried once; `<think>` reasoning before JSON ignored
- `AI_PROVIDER_ORDER` respected; translate via Groq never returns prices
- Provider out of daily quota is skipped on the next request; translate requests only the output tokens a batch needs

## 2. Browser end-to-end (Playwright, 67 checks, all passing)

Run against the production build in Chromium.

| Area | Checks |
|---|---|
| Viewports 375 / 430 / 768 / 1440 | No horizontal scrolling on home or menu; bottom nav only below 768px; 6 sample cards render |
| Search | Translated name, original script (डोसा), partial match, empty-results state |
| Filters & sort | Category, dietary, clear filters, price sort |
| Favourites | Toggle persists to localStorage; listed in My Menus |
| Dish details | Opens, shows demo/AI estimate labels and safety warning, “Explain this dish”, Escape closes |
| Demo language | Switching to 日本語 re-renders dish names |
| Suggestions | Rule-based suggestions labelled as such in demo |
| Preferences | Persist across reload; empty-ingredient validation; highlights appear on menu |
| Upload validation | Empty upload, unsupported type (.txt), preview, remove, replace path |
| No backend | Translate disabled with setup explanation; sample offered |
| Navigation | All 5 footer links, header language menu, skip link first in tab order |
| Live flow (mocked `/api`) | Success → 3 items; missing price shown as “Price not readable”; ₹120 kept even though the mock translator returned ₹999; Vegan lassi downgraded; Explain calls API and caches; saved menu listed; delete with confirmation |
| Per-minute limit | Translate returns 429 with a 2 s wait → countdown on the card’s button → continues automatically |
| Dish list first | After reading, the dish list opens directly (no translation yet, no picker); each dish shows pronunciation and “Translate this dish”; tapping sends exactly 1 dish and opens its details; a second dish is another single request |
| Dish fails | Malformed AI reply → error + “Try again” on that card → retry succeeds without re-reading the photo. Daily limit → error stays on that card, all 14 dishes kept, another dish later updates the same saved menu |
| Unknown language | Low-confidence detection → user picks Hindi → continues |
| Unreadable image | No dishes found → clear error with “Use a different photo” |
| Stability | No uncaught page errors across all flows |

## 3. Manual checklist (needs a real device or API key)

- [ ] Real menu photo in Hindi, Tamil and Bengali translates correctly (requires key)
- [ ] With only `GROQ_API_KEY` set, a real menu translates (menu shows “Read by Groq: …”)
- [ ] With an exhausted Gemini quota, translation still succeeds via Groq
- [ ] Very long menu (40+ items) completes; batch progress shows “Items 26–50 of N”
- [ ] Photo with handwritten or partly hidden prices shows them as unreadable, not guessed
- [ ] Gemini rate limit (send many requests quickly) shows the “quota busy” message
- [ ] Camera capture opens the rear camera on Android Chrome and iOS Safari
- [ ] HEIC photo shows the format message (or is auto-converted by iOS)
- [ ] VoiceOver (iOS) and TalkBack (Android): dish names in original script are read in the right language
- [ ] Keyboard only: complete upload → translate → open dish → favourite → close
- [ ] Private browsing / storage disabled: app still works; warning shown on Preferences
- [ ] `/api/health` on the deployed site returns `configured: true` and no key
- [ ] Network tab: no request goes to Google from the browser; no key appears anywhere
