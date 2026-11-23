import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MalformedAIResponse,
  parseJsonLoose,
  price,
  stripSafetyClaims,
  validateExtraction,
  validateRecommendations,
  validateTranslation,
} from '../src/lib/validate';
import { evaluateItem, localRecommendations } from '../src/lib/matching';
import { buildSampleMenu } from '../src/data/sampleMenu';
import type { ExtractedItem } from '../src/lib/types';

test('parseJsonLoose handles fences, prose and garbage', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Here you go: {"a":2} thanks'), { a: 2 });
  assert.throws(() => parseJsonLoose('not json at all'), MalformedAIResponse);
  assert.throws(() => parseJsonLoose(''), MalformedAIResponse);
  assert.throws(() => parseJsonLoose(undefined), MalformedAIResponse);
});

test('price parsing never guesses', () => {
  assert.equal(price(120), 120);
  assert.equal(price('₹120'), 120);
  assert.equal(price('Rs. 1,250/-'), 1250);
  assert.equal(price('120.50'), 120.5);
  assert.equal(price('90 / 160'), null); // two prices → ambiguous
  assert.equal(price('MRP'), null);
  assert.equal(price(-5), null);
  assert.equal(price(5_000_000), null);
  assert.equal(price(Number.NaN), null);
  assert.equal(price(null), null);
});

test('extraction: missing prices stay null, unreadable lines dropped, order preserved', () => {
  const { result } = validateExtraction({
    isMenu: true,
    detectedLanguage: 'Tamil',
    languageConfidence: 'high',
    items: [
      { originalName: 'மசாலா தோசை', price: 120, priceText: '₹120', nameConfidence: 'high' },
      { originalName: 'இட்லி', price: null, priceText: null },
      { originalName: '', price: 50 },
      { originalName: 'பொங்கல்', price: 'abc', priceText: '80 / 120' },
      'garbage',
    ],
  });
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items.map((i) => i.id), ['i1', 'i2', 'i3']);
  assert.equal(result.items[0].price, 120);
  assert.equal(result.items[1].price, null);
  assert.equal(result.items[1].priceConfidence, 'low');
  assert.equal(result.items[2].price, null);
  assert.equal(result.items[2].needsReview, true);
  assert.match(result.notes.join(' '), /2 unreadable line/);
});

test('extraction: unknown language gets low confidence; no items means not a menu', () => {
  const { result } = validateExtraction({ isMenu: true, detectedLanguage: 'Unknown', languageConfidence: 'high', items: [] });
  assert.equal(result.languageConfidence, 'low');
  assert.equal(result.isMenu, false);
  assert.throws(() => validateExtraction({ detectedLanguage: 'Hindi' }), MalformedAIResponse);
  assert.throws(() => validateExtraction('nope'), MalformedAIResponse);
});

const originals: ExtractedItem[] = [
  { id: 'i1', order: 0, originalName: 'चिकन टिक्का', originalCategory: null, priceText: '₹300', price: 300, priceConfidence: 'high', nameConfidence: 'high', needsReview: false, reviewNote: null },
  { id: 'i2', order: 1, originalName: 'दाल मखनी', originalCategory: null, priceText: '₹220', price: 220, priceConfidence: 'high', nameConfidence: 'high', needsReview: false, reviewNote: null },
  { id: 'i3', order: 2, originalName: 'मसाला चाय', originalCategory: null, priceText: null, price: null, priceConfidence: 'low', nameConfidence: 'high', needsReview: false, reviewNote: null },
];

test('translation: vegetarian label contradicted by chicken is downgraded to Unknown', () => {
  const out = validateTranslation(
    {
      items: [
        { id: 'i1', translatedName: 'Chicken Tikka', dietaryClassification: 'Vegetarian', dietaryConfidence: 'high', ingredients: [{ name: 'Chicken', certainty: 'listed on menu' }] },
        { id: 'i2', translatedName: 'Dal Makhani', dietaryClassification: 'Vegan', dietaryConfidence: 'high', ingredients: [{ name: 'Black lentils', certainty: 'likely' }, { name: 'Butter', certainty: 'likely' }, { name: 'Cream', certainty: 'likely' }] },
      ],
    },
    originals,
  );
  assert.equal(out[0].dietaryClassification, 'Unknown');
  assert.equal(out[1].dietaryClassification, 'Vegetarian'); // vegan removed because butter listed
  assert.match(out[1].dietaryNote ?? '', /Not vegan/);
});

test('translation: missing items fall back to untranslated, invented ids ignored, bad enums normalised', () => {
  const out = validateTranslation(
    {
      items: [
        { id: 'i1', translatedName: 'Chicken Tikka', spiceLevel: 'nuclear', foodCategory: 'starters', dietaryClassification: 'non-veg', priceINR: 1 },
        { id: 'zzz', translatedName: 'Invented Dish' },
      ],
    },
    originals,
  );
  assert.equal(out.length, 3);
  assert.equal(out[0].spiceLevel, 'Unknown');
  assert.equal(out[0].foodCategory, 'Snacks');
  assert.equal(out[0].dietaryClassification, 'Non-vegetarian');
  assert.equal(out[1].translatedName, 'दाल मखनी');
  assert.equal(out[1].dietaryClassification, 'Unknown');
  assert.ok(out.every((t) => t.translatedName !== 'Invented Dish'));
  assert.ok(!('priceINR' in out[0]));
});

test('translation: safety claims are stripped', () => {
  const out = validateTranslation(
    { items: [{ id: 'i3', translatedName: 'Masala Chai', description: 'Spiced milk tea. It is allergen-free.', allergenWarnings: ['Safe for people with allergies.', 'Contains dairy (milk).'] }] },
    originals,
  );
  const t = out[2];
  assert.equal(t.description, 'Spiced milk tea.');
  assert.deepEqual(t.allergenWarnings, ['Contains dairy (milk).']);
  assert.ok(t.flags.some((f) => /safety claim/.test(f)));
  assert.equal(stripSafetyClaims('Guaranteed 100% vegan.').text, '');
});

test('translation: totally empty response is malformed', () => {
  assert.throws(() => validateTranslation({ items: [] }, originals), MalformedAIResponse);
  assert.throws(() => validateTranslation({}, originals), MalformedAIResponse);
});

test('recommendations: only menu ids, max 3, no duplicates', () => {
  const ids = new Set(['a', 'b', 'c', 'd']);
  const recs = validateRecommendations(
    { recommendations: [{ id: 'x', reason: 'not on menu' }, { id: 'a', reason: 'r' }, { id: 'a', reason: 'dupe' }, { id: 'b', reason: 'r' }, { id: 'c', reason: 'r' }, { id: 'd', reason: 'r' }] },
    ids,
  );
  assert.deepEqual(recs.map((r) => r.itemId), ['a', 'b', 'c']);
});

test('preference matching flags conflicts and never claims safety', () => {
  const menu = buildSampleMenu('en');
  const chicken = menu.items.find((i) => i.originalName === 'चिकन बिरयानी')!;
  const paneer = menu.items.find((i) => i.originalName === 'पनीर बटर मसाला')!;
  const veg = { targetLanguage: 'en' as const, dietary: 'vegetarian' as const, spice: 'none' as const, avoid: [] };
  assert.equal(evaluateItem(chicken, veg).level, 'caution');
  assert.equal(evaluateItem(paneer, veg).level, 'match');
  const vegan = { ...veg, dietary: 'vegan' as const };
  assert.equal(evaluateItem(paneer, vegan).level, 'caution');
  const nuts = { ...veg, avoid: ['nuts'] };
  assert.ok(evaluateItem(paneer, nuts).cautions.some((c) => /nuts/.test(c))); // cashew paste
  const recs = localRecommendations(menu.items, { ...veg, spice: 'mild' });
  assert.ok(recs.length > 0 && recs.length <= 3);
  assert.ok(recs.every((r) => r.itemId !== chicken.id));
});

test('sample menu matches the brief and is labelled as demo', () => {
  for (const lang of ['en', 'es', 'fr', 'de', 'ja'] as const) {
    const m = buildSampleMenu(lang);
    assert.equal(m.isDemo, true);
    assert.equal(m.items.length, 6);
    assert.deepEqual(m.items.map((i) => i.priceINR), [120, 280, 220, 90, 260, 80]);
    assert.ok(m.items.every((i) => i.translatedName && i.description));
  }
});

test('extraction keeps the pronunciation (transliteration) for the dish picker', () => {
  const { result } = validateExtraction({ isMenu: true, detectedLanguage: 'Hindi', items: [{ originalName: 'मसाला डोसा', transliteration: 'Masala Dosa', price: 120 }, { originalName: 'समोसा' }] });
  assert.equal(result.items[0].transliteration, 'Masala Dosa');
  assert.equal(result.items[1].transliteration, null);
});
