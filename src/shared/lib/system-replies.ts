import type { SupportedLocale } from '../types/locale';

export const SYSTEM_REPLIES = {
  UNAVAILABLE_REPLY: {
    ar: 'عذرًا، الخدمة غير متوفرة حاليًا. يرجى المحاولة لاحقًا.',
    en: 'Sorry, the service is currently unavailable. Please try again later.',
  },
  TEXT_ONLY_REPLY: {
    ar: 'عذرًا، نحن نقبل الرسائل النصية فقط في الوقت الحالي.',
    en: 'Sorry, we only accept text messages at this time.',
  },
  SAFE_FALLBACK_REPLY: {
    ar: 'عذرًا، لا أملك معلومات كافية للإجابة على سؤالك. يرجى التواصل مع المتجر مباشرة.',
    en: "Sorry, I don't have enough information to answer your question. Please contact the store directly.",
  },
} as const;

export function getSystemReply(
  key: keyof typeof SYSTEM_REPLIES,
  locale: SupportedLocale
): string {
  return SYSTEM_REPLIES[key][locale];
}
