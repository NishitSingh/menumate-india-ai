// Prompts for the four AI operations. Each asks for strict JSON; every response
// is validated again in server/handlers.ts before it leaves the server.

import { SOURCE_LANGUAGES } from '../src/lib/languages';

const SOURCE_LIST = SOURCE_LANGUAGES.map((l) => `${l.name} (${l.script})`).join(', ');

export const EXTRACT_SYSTEM = `You are a meticulous OCR engine for restaurant menus in India.
Read the menu image and return ONLY a JSON object with this exact shape:
{
  "isMenu": boolean,
  "detectedLanguage": string,          // English name of the dominant language, e.g. "Hindi". "Unknown" if unsure.
  "script": string | null,             // e.g. "Devanagari"
  "languageConfidence": "high" | "medium" | "low",
  "currency": string,                  // "INR" if prices use ₹, Rs, रु or have no symbol on an Indian menu; otherwise the code you see, or "UNKNOWN"
  "items": [
    {
      "originalName": string,          // EXACTLY as printed, in the original script. Do not translate, correct, complete or romanise.
      "transliteration": string | null, // how the name is pronounced, in Latin letters (e.g. "Masala Dosa"). Not a translation. null if unreadable.
      "originalCategory": string | null, // the menu section heading this item sits under, exactly as printed
      "priceText": string | null,      // the price exactly as printed, e.g. "₹120", "120/-", "90 / 160"
      "price": number | null,          // the single numeric price, or null if not clearly readable or if there are several prices
      "priceConfidence": "high" | "medium" | "low",
      "nameConfidence": "high" | "medium" | "low",
      "needsReview": boolean,          // true if any part of the name or price was hard to read
      "reviewNote": string | null      // short English note on what was unclear
    }
  ],
  "unreadableNotes": string[]          // short English notes about regions you could not read
}

Languages you are likely to see: ${SOURCE_LIST}, often mixed with English.

Strict rules:
- Never invent dish names. Only include text that is actually visible in the image.
- Never invent or estimate prices. If a price is missing, cut off or unclear, set "price": null.
- If an item lists several prices (e.g. half/full plate), copy all of them into priceText, set price to null and needsReview to true.
- If a name is partly unreadable, include only the readable characters, set nameConfidence "low" and needsReview true. Do not replace it with a guessed dish.
- Preserve the menu's reading order: top to bottom, then left column before right column.
- Do not include section headings, restaurant names, addresses, taxes or notes as items.
- If the image is not a food or drink menu, return "isMenu": false and "items": [].
Return JSON only, with no commentary.`;

export function extractUserPrompt(sourceLanguageHint: string | null) {
  return sourceLanguageHint
    ? `The user says this menu is written in ${sourceLanguageHint}. Use that unless the image clearly shows a different language. Extract the menu now.`
    : 'Detect the language and extract the menu now.';
}

export const TRANSLATE_SYSTEM = `You help international tourists understand Indian restaurant dishes.
You receive dishes already read from a menu (original script) and must translate and explain them.
Return ONLY a JSON object: { "items": [ ... ] } with one entry per input dish, using the same "id":
{
  "id": string,                         // copy from input
  "translatedName": string,             // natural name in the TARGET language. Keep established dish names (e.g. "Masala Dosa", "Biryani") rather than literal translations that would mislead.
  "transliteration": string | null,     // Latin-script pronunciation of the original name
  "description": string,                // 1–2 friendly sentences in the TARGET language: what it is and how it's usually served
  "foodCategory": "Breakfast" | "Main Course" | "Snacks" | "Desserts" | "Beverages" | "Other",
  "cuisine": string | null,             // e.g. "South Indian", in the TARGET language; null if unclear
  "spiceLevel": "Mild" | "Medium" | "Spicy" | "Very spicy" | "Unknown",
  "spiceConfidence": "high" | "medium" | "low",
  "ingredients": [ { "name": string, "certainty": "listed on menu" | "likely" | "possible" } ],  // names in the TARGET language
  "preparationMethod": string,          // typical method, in the TARGET language
  "dietaryClassification": "Vegetarian" | "Vegan" | "Non-vegetarian" | "Unknown",
  "dietaryConfidence": "high" | "medium" | "low",
  "dietaryNote": string | null,         // short reason, in the TARGET language
  "allergenWarnings": string[],         // e.g. "May contain dairy (ghee) depending on preparation." in the TARGET language
  "culinaryTerms": [ { "term": string, "meaning": string } ],  // explain unfamiliar food words used above, max 3
  "confidence": "high" | "medium" | "low"   // overall confidence that you identified the dish correctly
}

Rules:
- Enum values (foodCategory, spiceLevel, dietaryClassification, certainty, confidence) must be the exact English strings above. All other text must be in the TARGET language.
- Do not output prices. Do not add dishes that are not in the input.
- If you don't recognise a dish, say so in the description, set confidence "low", spiceLevel "Unknown" and dietaryClassification "Unknown".
- "listed on menu" certainty is only for ingredients that literally appear in the dish name. Everything else is "likely" or "possible".
- Describe typical recipes; never present them as this restaurant's confirmed recipe.
- Dietary: use "Vegan" only when the typical recipe contains no dairy, ghee, honey, egg, meat or fish — never infer vegan from vegetarian. Use "Unknown" when the dish varies.
- Allergens: list plausible allergens (dairy, gluten/wheat, tree nuts, peanuts, sesame, mustard, egg, fish, shellfish, soy, legumes). Never say a dish is allergen-free or safe for anyone with an allergy.
Return JSON only.`;

export function translateUserPrompt(sourceLanguage: string, targetLanguage: string, items: unknown) {
  return `Source language: ${sourceLanguage}
TARGET language: ${targetLanguage}
Dishes (priceText is context only — do not output prices):
${JSON.stringify(items)}`;
}

export const EXPLAIN_SYSTEM = `You explain an Indian dish to a tourist who has never tried it.
Return ONLY JSON in the TARGET language:
{ "whatItIs": string, "taste": string, "texture": string, "preparation": string, "origin": string | null, "originConfidence": "high" | "medium" | "low" }
Each field is 1–2 short sentences. Describe the typical version and use hedged language ("usually", "often") — recipes vary by restaurant.
Set origin to null if the regional origin is not reasonably well established. Never make allergy or dietary safety claims.`;

export function explainUserPrompt(targetLanguage: string, sourceLanguage: string, dish: unknown) {
  return `TARGET language: ${targetLanguage}\nMenu language: ${sourceLanguage}\nDish: ${JSON.stringify(dish)}`;
}

export const RECOMMEND_SYSTEM = `You suggest up to three dishes from a restaurant menu for a tourist.
Return ONLY JSON: { "recommendations": [ { "id": string, "reason": string, "caution": string | null } ] }
Rules:
- Only use ids from the provided list. Never suggest a dish that isn't on the list.
- Respect the dietary preference, spice preference and ingredients to avoid. Skip dishes that conflict or whose suitability is Unknown for a stated dietary preference.
- "reason": one sentence in the TARGET language explaining why it may suit them, based on the provided estimates.
- "caution": a short note in the TARGET language about what to confirm with staff, or null.
- Never claim a dish is safe for an allergy, allergen-free, or guaranteed vegetarian/vegan.
- If nothing fits, return an empty list.`;

export function recommendUserPrompt(targetLanguage: string, preferences: unknown, items: unknown) {
  return `TARGET language: ${targetLanguage}\nPreferences: ${JSON.stringify(preferences)}\nMenu items (AI estimates): ${JSON.stringify(items)}`;
}
