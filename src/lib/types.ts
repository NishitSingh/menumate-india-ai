// Core data model for MenuMate India AI.
// Field names are camelCase in TypeScript; the spec's snake_case names map 1:1
// (e.g. price_inr -> priceINR, food_category -> foodCategory).

export type Confidence = 'high' | 'medium' | 'low';
export type SpiceLevel = 'Mild' | 'Medium' | 'Spicy' | 'Very spicy' | 'Unknown';
export type Dietary = 'Vegetarian' | 'Vegan' | 'Non-vegetarian' | 'Unknown';
export type FoodCategory =
  | 'Breakfast'
  | 'Main Course'
  | 'Snacks'
  | 'Desserts'
  | 'Beverages'
  | 'Other';
export type TargetLanguageCode = 'en' | 'es' | 'fr' | 'de' | 'ja';
export type IngredientCertainty = 'listed on menu' | 'likely' | 'possible';

export interface Ingredient {
  name: string;
  certainty: IngredientCertainty;
}

export interface CulinaryTerm {
  term: string;
  meaning: string;
}

export interface DishExplanation {
  whatItIs: string;
  taste: string;
  texture: string;
  preparation: string;
  origin: string | null;
  originConfidence: Confidence;
}

/** One dish. Fields marked [menu] come only from OCR of the menu image. */
export interface MenuItem {
  id: string;
  order: number;
  // [menu] — extracted, never overwritten by later AI steps
  originalName: string;
  originalCategory: string | null;
  nameConfidence: Confidence;
  needsReview: boolean;
  reviewNote: string | null;
  priceINR: number | null;
  priceText: string | null;
  priceConfidence: Confidence;
  // [AI estimate] — translation + dish intelligence
  translatedName: string;
  transliteration: string | null;
  description: string;
  foodCategory: FoodCategory;
  cuisine: string | null;
  spiceLevel: SpiceLevel;
  spiceConfidence: Confidence;
  ingredients: Ingredient[];
  preparationMethod: string;
  dietaryClassification: Dietary;
  dietaryConfidence: Confidence;
  dietaryNote: string | null;
  allergenWarnings: string[];
  culinaryTerms: CulinaryTerm[];
  confidence: Confidence;
  explanation: DishExplanation | null;
  /** Notes added by the validator (e.g. "translation missing"). */
  flags: string[];
}

export interface SavedMenu {
  id: string;
  title: string;
  imageName: string | null;
  /** Small JPEG data URL (~240px). The full image is never stored. */
  thumbnail: string | null;
  sourceLanguage: string;
  sourceLanguageConfidence: Confidence;
  targetLanguage: TargetLanguageCode;
  status: 'complete' | 'partial';
  createdAt: string;
  isDemo: boolean;
  currency: string;
  items: MenuItem[];
  notes: string[];
  model: string | null;
}

export type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'dairy-free';
export type SpicePreference = 'none' | 'mild' | 'medium' | 'spicy';

export interface UserPreferences {
  targetLanguage: TargetLanguageCode;
  dietary: DietaryPreference;
  spice: SpicePreference;
  avoid: string[];
}

export interface Favourite {
  menuId: string;
  itemId: string;
  savedAt: string;
  snapshot: { originalName: string; translatedName: string; priceINR: number | null };
}

// ---- AI operation payloads -------------------------------------------------

export interface ExtractedItem {
  id: string;
  order: number;
  originalName: string;
  /** Pronunciation in Latin letters, read with the menu so tourists can pick a dish. */
  transliteration?: string | null;
  originalCategory: string | null;
  priceText: string | null;
  price: number | null;
  priceConfidence: Confidence;
  nameConfidence: Confidence;
  needsReview: boolean;
  reviewNote: string | null;
}

export interface ExtractionResult {
  isMenu: boolean;
  detectedLanguage: string;
  script: string | null;
  languageConfidence: Confidence;
  currency: string;
  items: ExtractedItem[];
  notes: string[];
}

export interface TranslatedItem {
  id: string;
  translatedName: string;
  transliteration: string | null;
  description: string;
  foodCategory: FoodCategory;
  cuisine: string | null;
  spiceLevel: SpiceLevel;
  spiceConfidence: Confidence;
  ingredients: Ingredient[];
  preparationMethod: string;
  dietaryClassification: Dietary;
  dietaryConfidence: Confidence;
  dietaryNote: string | null;
  allergenWarnings: string[];
  culinaryTerms: CulinaryTerm[];
  confidence: Confidence;
  flags: string[];
}

export interface Recommendation {
  itemId: string;
  reason: string;
  caution: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; retryable: boolean };
}
