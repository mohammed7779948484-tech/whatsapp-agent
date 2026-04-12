import { describe, expect, it } from 'vitest';

import { SYSTEM_REPLIES, getSystemReply } from '../../../src/shared/lib/system-replies';

describe('system replies', () => {
  it('returns the Arabic unavailable reply', () => {
    expect(getSystemReply('UNAVAILABLE_REPLY', 'ar')).toBe(
      'عذرًا، الخدمة غير متوفرة حاليًا. يرجى المحاولة لاحقًا.'
    );
  });

  it('returns the English unavailable reply', () => {
    expect(getSystemReply('UNAVAILABLE_REPLY', 'en')).toBe(
      'Sorry, the service is currently unavailable. Please try again later.'
    );
  });

  it('defines all reply keys in both locales', () => {
    expect(SYSTEM_REPLIES.UNAVAILABLE_REPLY).toMatchObject({ ar: expect.any(String), en: expect.any(String) });
    expect(SYSTEM_REPLIES.TEXT_ONLY_REPLY).toMatchObject({ ar: expect.any(String), en: expect.any(String) });
    expect(SYSTEM_REPLIES.SAFE_FALLBACK_REPLY).toMatchObject({ ar: expect.any(String), en: expect.any(String) });
  });
});
