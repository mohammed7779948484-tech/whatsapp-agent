import { describe, expect, it } from 'vitest';

import { localeFromText } from '../../../src/shared/lib/locale-from-text';

describe('localeFromText', () => {
  it("returns 'ar' for Arabic text", () => {
    expect(localeFromText('مرحبا كيف حالك')).toBe('ar');
  });

  it("returns 'en' for English text", () => {
    expect(localeFromText('Hello, how are you?')).toBe('en');
  });

  it("returns 'ar' for mixed text with more than 30 percent Arabic", () => {
    expect(localeFromText('مرحبا hello عالم')).toBe('ar');
  });

  it("returns 'en' for mixed text with less than 30 percent Arabic", () => {
    expect(localeFromText('hello world test م')).toBe('en');
  });

  it("returns 'ar' for an empty string", () => {
    expect(localeFromText('')).toBe('ar');
  });

  it("returns 'ar' for numbers only", () => {
    expect(localeFromText('123456')).toBe('ar');
  });
});
