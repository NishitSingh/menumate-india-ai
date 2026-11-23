import type { TargetLanguageCode } from './types';

/** Source languages the AI is asked to recognise. Add entries here to extend support. */
export const SOURCE_LANGUAGES: { code: string; name: string; native: string; script: string }[] = [
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', script: 'Devanagari' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', script: 'Bengali' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', script: 'Tamil' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', script: 'Telugu' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', script: 'Kannada' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', script: 'Malayalam' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', script: 'Devanagari' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', script: 'Gujarati' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', script: 'Gurmukhi' },
  { code: 'ur', name: 'Urdu', native: 'اردو', script: 'Perso-Arabic' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', script: 'Odia' },
];

export const TARGET_LANGUAGES: { code: TargetLanguageCode; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
];

export const AUTO_DETECT = 'auto';

export function targetName(code: string): string {
  return TARGET_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export function isTargetCode(v: unknown): v is TargetLanguageCode {
  return typeof v === 'string' && TARGET_LANGUAGES.some((l) => l.code === v);
}

/** Best-effort BCP-47 tag for the original-script text, used for lang="" attributes. */
export function langTagFor(languageName: string): string | undefined {
  const hit = SOURCE_LANGUAGES.find((l) => l.name.toLowerCase() === languageName.toLowerCase());
  return hit?.code;
}

export function sourceNameFromCode(code: string): string | null {
  return SOURCE_LANGUAGES.find((l) => l.code === code)?.name ?? null;
}
