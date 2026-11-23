// Preference matching. Produces *hints* only — never a guarantee of suitability.

import type { MenuItem, Recommendation, SpiceLevel, UserPreferences } from './types';
import { DAIRY_TERMS } from './validate';

export type MatchLevel = 'match' | 'caution' | 'neutral';
export interface MatchResult {
  level: MatchLevel;
  reasons: string[];
  cautions: string[];
}

const SPICE_RANK: Record<SpiceLevel, number> = { Mild: 1, Medium: 2, Spicy: 3, 'Very spicy': 4, Unknown: 0 };

/** Expands common allergen groups so "nuts" also catches "cashew". */
const SYNONYMS: Record<string, string[]> = {
  nut: ['nut', 'cashew', 'almond', 'pistachio', 'peanut', 'walnut', 'groundnut', 'kaju', 'badam'],
  nuts: ['nut', 'cashew', 'almond', 'pistachio', 'peanut', 'walnut', 'groundnut', 'kaju', 'badam'],
  peanut: ['peanut', 'groundnut', 'moongphali'],
  dairy: DAIRY_TERMS,
  milk: DAIRY_TERMS,
  gluten: ['gluten', 'wheat', 'maida', 'atta', 'semolina', 'rava', 'sooji', 'suji', 'barley'],
  wheat: ['wheat', 'maida', 'atta', 'semolina', 'rava', 'sooji', 'suji'],
  egg: ['egg', 'anda'],
  eggs: ['egg', 'anda'],
  shellfish: ['shellfish', 'prawn', 'shrimp', 'crab', 'lobster', 'jhinga'],
  fish: ['fish', 'machli', 'prawn', 'shrimp'],
  onion: ['onion', 'pyaz', 'pyaaz'],
  garlic: ['garlic', 'lehsun'],
  coriander: ['coriander', 'cilantro', 'dhania'],
  mustard: ['mustard', 'rai', 'sarson'],
  sesame: ['sesame', 'til'],
  soy: ['soy', 'soya'],
  coconut: ['coconut', 'nariyal'],
};

function haystack(item: MenuItem): string {
  return [
    item.originalName,
    item.translatedName,
    item.transliteration ?? '',
    item.description,
    item.preparationMethod,
    ...item.ingredients.map((i) => i.name),
    ...item.allergenWarnings,
  ]
    .join(' ')
    .toLowerCase();
}

export function findAvoided(item: MenuItem, avoid: string[]): string[] {
  const h = haystack(item);
  const hits: string[] = [];
  for (const raw of avoid) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;
    const variants = SYNONYMS[term] ?? [term];
    if (variants.some((v) => h.includes(v))) hits.push(raw.trim());
  }
  return hits;
}

export function evaluateItem(item: MenuItem, prefs: UserPreferences): MatchResult {
  const reasons: string[] = [];
  const cautions: string[] = [];
  const d = item.dietaryClassification;
  const lowConf = item.dietaryConfidence === 'low' ? ' (low confidence)' : '';

  switch (prefs.dietary) {
    case 'vegetarian':
      if (d === 'Vegetarian' || d === 'Vegan') reasons.push(`Estimated ${d.toLowerCase()}${lowConf}`);
      else if (d === 'Non-vegetarian') cautions.push('Estimated non-vegetarian');
      else cautions.push('Vegetarian status unknown');
      break;
    case 'vegan':
      if (d === 'Vegan') reasons.push(`Estimated vegan${lowConf}`);
      else if (d === 'Vegetarian') cautions.push('Vegetarian, but vegan is not confirmed');
      else if (d === 'Non-vegetarian') cautions.push('Estimated non-vegetarian');
      else cautions.push('Vegan status unknown');
      break;
    case 'dairy-free': {
      const dairy = findAvoided(item, ['dairy']);
      if (dairy.length || /dairy|milk/i.test(item.allergenWarnings.join(' '))) cautions.push('May contain dairy');
      else if (item.ingredients.length) reasons.push('No dairy among the estimated ingredients');
      else cautions.push('Ingredients unknown');
      break;
    }
  }

  const rank = SPICE_RANK[item.spiceLevel];
  if (prefs.spice !== 'none') {
    const want = prefs.spice === 'mild' ? 1 : prefs.spice === 'medium' ? 2 : 3;
    if (rank === 0) cautions.push('Spice level unknown');
    else if (prefs.spice === 'spicy') {
      if (rank >= 3) reasons.push(`Estimated ${item.spiceLevel.toLowerCase()}`);
    } else if (rank <= want) reasons.push(`Estimated ${item.spiceLevel.toLowerCase()} spice`);
    else cautions.push(`Estimated ${item.spiceLevel.toLowerCase()} — may be hotter than you like`);
  }

  for (const hit of findAvoided(item, prefs.avoid)) cautions.push(`May contain ${hit}`);

  const level: MatchLevel = cautions.length ? 'caution' : reasons.length ? 'match' : 'neutral';
  return { level, reasons, cautions };
}

export function hasActivePreferences(p: UserPreferences): boolean {
  return p.dietary !== 'none' || p.spice !== 'none' || p.avoid.length > 0;
}

/** Rule-based suggestions used in demo mode or when the AI service is unavailable. */
export function localRecommendations(items: MenuItem[], prefs: UserPreferences): Recommendation[] {
  const scored = items
    .map((item) => ({ item, m: evaluateItem(item, prefs) }))
    .filter(({ m }) => m.level !== 'caution')
    .sort((a, b) => b.m.reasons.length - a.m.reasons.length || a.item.order - b.item.order);
  return scored.slice(0, 3).map(({ item, m }) => ({
    itemId: item.id,
    reason: m.reasons.length
      ? `${m.reasons.join('; ')}.`
      : `${item.translatedName} has no conflicts with your saved preferences.`,
    caution: 'Based on estimates — confirm ingredients with staff.',
  }));
}
