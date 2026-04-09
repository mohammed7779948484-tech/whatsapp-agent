import { DEFAULT_LOCALE, type SupportedLocale } from '../types/locale';

const ARABIC_CHARACTER_PATTERN = /[\u0600-\u06FF]/g;
const ALPHABETIC_CHARACTER_PATTERN = /\p{L}/gu;
const ARABIC_THRESHOLD = 0.3;

export function localeFromText(text: string): SupportedLocale {
  const alphabeticCharacters = text.match(ALPHABETIC_CHARACTER_PATTERN) ?? [];

  if (alphabeticCharacters.length === 0) {
    return DEFAULT_LOCALE;
  }

  const arabicCharacters = text.match(ARABIC_CHARACTER_PATTERN) ?? [];
  const arabicRatio = arabicCharacters.length / alphabeticCharacters.length;

  return arabicRatio >= ARABIC_THRESHOLD ? 'ar' : 'en';
}
