// Validation for every AI response before it reaches the UI.
// Shared by the serverless functions and the browser. No DOM or Node APIs here.

import type {
  Confidence,
  Dietary,
  DishExplanation,
  ExtractedItem,
  ExtractionResult,
  FoodCategory,
  Ingredient,
  IngredientCertainty,
  Recommendation,
  SpiceLevel,
  TranslatedItem,
} from './types';

export class MalformedAIResponse extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedAIResponse';
  }
}

const MAX_ITEMS = 150;
const MAX_PRICE = 100_000; // ₹1 lakh per dish is a sane upper bound for menus

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** Parse model output that should be JSON; tolerates ```json fences and leading prose. */
export function parseJsonLoose(text: unknown): unknown {
  if (typeof text !== 'string' || !text.trim()) throw new MalformedAIResponse('Empty response');
  // Some open models (e.g. Qwen on Groq) may prepend <think>…</think> reasoning.
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new MalformedAIResponse('Response was not valid JSON');
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function str(v: unknown, max = 600): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function conf(v: unknown, fallback: Confidence = 'low'): Confidence {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
  return s === 'high' || s === 'medium' || s === 'low' ? s : fallback;
}

const CATEGORY_MAP: Record<string, FoodCategory> = {
  breakfast: 'Breakfast',
  'main course': 'Main Course',
  main: 'Main Course',
  mains: 'Main Course',
  snack: 'Snacks',
  snacks: 'Snacks',
  starter: 'Snacks',
  starters: 'Snacks',
  dessert: 'Desserts',
  desserts: 'Desserts',
  sweets: 'Desserts',
  beverage: 'Beverages',
  beverages: 'Beverages',
  drinks: 'Beverages',
  other: 'Other',
  unknown: 'Other',
};
export function category(v: unknown): FoodCategory {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
  return CATEGORY_MAP[s] ?? 'Other';
}

const SPICE_MAP: Record<string, SpiceLevel> = {
  mild: 'Mild',
  medium: 'Medium',
  spicy: 'Spicy',
  hot: 'Spicy',
  'very spicy': 'Very spicy',
  'very hot': 'Very spicy',
  unknown: 'Unknown',
};
export function spice(v: unknown): SpiceLevel {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
  return SPICE_MAP[s] ?? 'Unknown';
}

const DIET_MAP: Record<string, Dietary> = {
  vegetarian: 'Vegetarian',
  veg: 'Vegetarian',
  vegan: 'Vegan',
  'non-vegetarian': 'Non-vegetarian',
  'non vegetarian': 'Non-vegetarian',
  'non-veg': 'Non-vegetarian',
  nonveg: 'Non-vegetarian',
  unknown: 'Unknown',
};
export function dietary(v: unknown): Dietary {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
  return DIET_MAP[s] ?? 'Unknown';
}

function certainty(v: unknown): IngredientCertainty {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
  if (s === 'listed on menu' || s === 'confirmed' || s === 'listed') return 'listed on menu';
  if (s === 'likely' || s === 'probable') return 'likely';
  return 'possible';
}

/**
 * Price parsing. Accepts numbers or strings like "₹120", "Rs. 120/-", "120.00".
 * Anything ambiguous, negative or absurd becomes null — we never guess a price.
 */
export function price(v: unknown): number | null {
  let n: number | null = null;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    const cleaned = v.replace(/[,\s]/g, '').replace(/^(₹|rs\.?|inr|रु\.?)/i, '').replace(/\/-$/, '');
    if (/^\d+(\.\d{1,2})?$/.test(cleaned)) n = Number(cleaned);
  }
  if (n === null || !Number.isFinite(n) || n < 0 || n > MAX_PRICE) return null;
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Safety filters
// ---------------------------------------------------------------------------

const SAFETY_CLAIM = new RegExp(
  [
    'allergen[- ]?free',
    'free (of|from) (all )?allergens',
    'no allergens',
    'safe (for|to eat for) (people|anyone|those|you|someone)?\\s*(with)?\\s*(an? )?(allerg|intoleran)',
    'safe for (allerg|celiac|coeliac)',
    'guaranteed',
    '100% (veg|vegan|vegetarian|safe)',
    'completely safe',
  ].join('|'),
  'i',
);

/** Removes sentences that claim allergen-freedom or allergy safety. */
export function stripSafetyClaims(text: string): { text: string; removed: boolean } {
  if (!SAFETY_CLAIM.test(text)) return { text, removed: false };
  // No regex lookbehind here: it breaks parsing on iOS Safari < 16.4.
  const sentences = text.match(/[^.!?。]+[.!?。]*/g) ?? [text];
  const kept = sentences.map((s) => s.trim()).filter((s) => s && !SAFETY_CLAIM.test(s));
  return { text: kept.join(' ').trim(), removed: true };
}

export const DAIRY_TERMS = [
  'milk', 'cream', 'butter', 'ghee', 'paneer', 'cheese', 'yoghurt', 'yogurt', 'curd', 'dahi',
  'khoa', 'khoya', 'mawa', 'malai', 'raita', 'buttermilk', 'lassi', 'chhena', 'chenna',
];
export const ANIMAL_TERMS = [
  'chicken', 'mutton', 'lamb', 'goat', 'beef', 'pork', 'fish', 'prawn', 'shrimp', 'crab',
  'lobster', 'egg', 'meat', 'keema', 'murgh', 'gosht', 'machli', 'jhinga', 'anda',
];
const HONEY_TERMS = ['honey'];

function mentions(haystack: string, terms: string[]): string | null {
  const h = haystack.toLowerCase();
  for (const t of terms) {
    if (new RegExp(`(^|[^a-z])${t}`, 'i').test(h)) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Operation 1 — extraction
// ---------------------------------------------------------------------------

export function validateExtraction(raw: unknown): { result: ExtractionResult; warnings: string[] } {
  if (!isObj(raw)) throw new MalformedAIResponse('Extraction result is not an object');
  const warnings: string[] = [];
  const rawItems = Array.isArray(raw.items) ? raw.items : null;
  if (!rawItems) throw new MalformedAIResponse('Extraction result has no items array');

  const items: ExtractedItem[] = [];
  let dropped = 0;
  for (const r of rawItems.slice(0, MAX_ITEMS)) {
    if (!isObj(r)) {
      dropped++;
      continue;
    }
    const originalName = str(r.originalName, 160);
    if (!originalName) {
      dropped++;
      continue;
    }
    const priceText = str(r.priceText, 60);
    // Prefer the explicit numeric price; fall back to parsing the printed text.
    let p = price(r.price);
    if (p === null && priceText) p = price(priceText);
    const nameConfidence = conf(r.nameConfidence, 'medium');
    let needsReview = r.needsReview === true || nameConfidence === 'low';
    let reviewNote = str(r.reviewNote, 200);
    if (p === null && priceText) {
      needsReview = true;
      reviewNote = reviewNote ?? `Price printed as "${priceText}" could not be read as a single number.`;
    }
    items.push({
      id: `i${items.length + 1}`,
      order: items.length,
      originalName,
      transliteration: str(r.transliteration, 160),
      originalCategory: str(r.originalCategory, 80),
      priceText,
      price: p,
      priceConfidence: p === null ? 'low' : conf(r.priceConfidence, 'medium'),
      nameConfidence,
      needsReview,
      reviewNote,
    });
  }
  if (rawItems.length > MAX_ITEMS) warnings.push(`Only the first ${MAX_ITEMS} items were kept.`);
  if (dropped) warnings.push(`${dropped} unreadable line(s) were skipped.`);

  const notes = Array.isArray(raw.unreadableNotes ?? raw.notes)
    ? ((raw.unreadableNotes ?? raw.notes) as unknown[]).map((n) => str(n, 200)).filter((n): n is string => !!n).slice(0, 10)
    : [];

  const detected = str(raw.detectedLanguage, 40) ?? 'Unknown';
  return {
    result: {
      isMenu: raw.isMenu !== false && items.length > 0,
      detectedLanguage: detected,
      script: str(raw.script, 40),
      languageConfidence: detected === 'Unknown' ? 'low' : conf(raw.languageConfidence, 'medium'),
      currency: (str(raw.currency, 10) ?? 'INR').toUpperCase(),
      items,
      notes: [...notes, ...warnings],
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Operations 2 + 3 — translation and dish intelligence
// ---------------------------------------------------------------------------

export function validateTranslatedItem(r: Record<string, unknown>, original: ExtractedItem): TranslatedItem {
  const flags: string[] = [];
  const translatedName = str(r.translatedName, 160);
  if (!translatedName) flags.push('No translation was returned for this name; showing the original.');

  const ingredients: Ingredient[] = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .filter(isObj)
    .map((i) => ({ name: str(i.name, 60) ?? '', certainty: certainty(i.certainty) }))
    .filter((i) => i.name)
    .slice(0, 20);

  let description = str(r.description, 500) ?? '';
  const descCheck = stripSafetyClaims(description);
  description = descCheck.text;

  let allergenWarnings = (Array.isArray(r.allergenWarnings) ? r.allergenWarnings : [])
    .map((a) => str(a, 200))
    .filter((a): a is string => !!a);
  const before = allergenWarnings.length;
  allergenWarnings = allergenWarnings.filter((a) => !SAFETY_CLAIM.test(a)).slice(0, 10);
  if (descCheck.removed || before !== allergenWarnings.length) {
    flags.push('An unsupported safety claim was removed from the AI output.');
  }

  let diet = dietary(r.dietaryClassification);
  let dietConf = conf(r.dietaryConfidence, 'low');
  let dietaryNote = str(r.dietaryNote, 240);

  // Cross-check the model's dietary label against its own ingredient list and the dish name.
  const ingredientText = ingredients.map((i) => i.name).join(' ');
  const nameText = `${original.originalName} ${translatedName ?? ''}`;
  const animal = mentions(`${ingredientText} ${nameText}`, ANIMAL_TERMS);
  if ((diet === 'Vegetarian' || diet === 'Vegan') && animal) {
    diet = 'Unknown';
    dietConf = 'low';
    flags.push(`Dietary label conflicted with a listed ingredient ("${animal}") and was set to Unknown.`);
  }
  if (diet === 'Vegan') {
    const dairy = mentions(`${ingredientText} ${allergenWarnings.join(' ')}`, [...DAIRY_TERMS, ...HONEY_TERMS]);
    if (dairy) {
      diet = 'Vegetarian';
      dietConf = 'low';
      dietaryNote = `Not vegan: likely contains ${dairy}.`;
      flags.push('Vegan label removed because an animal-derived ingredient was listed.');
    }
  }

  return {
    id: original.id,
    translatedName: translatedName ?? original.originalName,
    transliteration: str(r.transliteration, 160),
    description: description || '',
    foodCategory: category(r.foodCategory),
    cuisine: str(r.cuisine, 60),
    spiceLevel: spice(r.spiceLevel),
    spiceConfidence: conf(r.spiceConfidence, 'low'),
    ingredients,
    preparationMethod: str(r.preparationMethod, 500) ?? '',
    dietaryClassification: diet,
    dietaryConfidence: diet === 'Unknown' ? 'low' : dietConf,
    dietaryNote,
    allergenWarnings,
    culinaryTerms: (Array.isArray(r.culinaryTerms) ? r.culinaryTerms : [])
      .filter(isObj)
      .map((t) => ({ term: str(t.term, 60) ?? '', meaning: str(t.meaning, 200) ?? '' }))
      .filter((t) => t.term && t.meaning)
      .slice(0, 6),
    confidence: conf(r.confidence, 'low'),
    flags,
  };
}

/** Fallback used when the model omits an item: the dish is shown untranslated, all estimates Unknown. */
export function untranslatedItem(original: ExtractedItem, reason: string): TranslatedItem {
  return {
    id: original.id,
    translatedName: original.originalName,
    transliteration: null,
    description: '',
    foodCategory: 'Other',
    cuisine: null,
    spiceLevel: 'Unknown',
    spiceConfidence: 'low',
    ingredients: [],
    preparationMethod: '',
    dietaryClassification: 'Unknown',
    dietaryConfidence: 'low',
    dietaryNote: null,
    allergenWarnings: [],
    culinaryTerms: [],
    confidence: 'low',
    flags: [reason],
  };
}

export function validateTranslation(raw: unknown, originals: ExtractedItem[]): TranslatedItem[] {
  if (!isObj(raw) || !Array.isArray(raw.items)) {
    throw new MalformedAIResponse('Translation result has no items array');
  }
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of raw.items) {
    if (isObj(r) && typeof r.id === 'string') byId.set(r.id, r);
  }
  if (byId.size === 0 && originals.length > 0) {
    throw new MalformedAIResponse('Translation result contained no recognisable items');
  }
  // Output follows the extracted order; items the model invented (unknown ids) are ignored.
  return originals.map((o) => {
    const r = byId.get(o.id);
    return r ? validateTranslatedItem(r, o) : untranslatedItem(o, 'The AI did not return a translation for this item.');
  });
}

// ---------------------------------------------------------------------------
// "Explain this dish" and recommendations
// ---------------------------------------------------------------------------

export function validateExplanation(raw: unknown): DishExplanation {
  if (!isObj(raw)) throw new MalformedAIResponse('Explanation is not an object');
  const field = (k: string) => stripSafetyClaims(str(raw[k], 600) ?? '').text;
  const out: DishExplanation = {
    whatItIs: field('whatItIs'),
    taste: field('taste'),
    texture: field('texture'),
    preparation: field('preparation'),
    origin: str(raw.origin, 400),
    originConfidence: conf(raw.originConfidence, 'low'),
  };
  if (!out.whatItIs && !out.taste && !out.preparation) {
    throw new MalformedAIResponse('Explanation was empty');
  }
  return out;
}

export function validateRecommendations(raw: unknown, validIds: Set<string>): Recommendation[] {
  if (!isObj(raw) || !Array.isArray(raw.recommendations)) {
    throw new MalformedAIResponse('Recommendations missing');
  }
  const seen = new Set<string>();
  const out: Recommendation[] = [];
  for (const r of raw.recommendations) {
    if (!isObj(r)) continue;
    const id = typeof r.id === 'string' ? r.id : typeof r.itemId === 'string' ? r.itemId : '';
    if (!validIds.has(id) || seen.has(id)) continue; // only dishes that are actually on the menu
    const reason = stripSafetyClaims(str(r.reason, 300) ?? '').text;
    if (!reason) continue;
    seen.add(id);
    out.push({ itemId: id, reason, caution: str(r.caution, 240) });
    if (out.length === 3) break;
  }
  return out;
}
