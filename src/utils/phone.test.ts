import { describe, expect, it } from 'vitest';
import { formatPhoneDisplay, isPhoneComplete, phoneDigits } from '@/utils/phone';

describe('phoneDigits', () => {
  it('strips non-digit characters', () => {
    expect(phoneDigits('+7 (777) 123-45-67')).toBe('77771234567');
  });

  it('converts the local trunk prefix 8 to 7', () => {
    expect(phoneDigits('8 777 123 45 67')).toBe('77771234567');
  });

  it('assumes the +7 country code when it is missing', () => {
    expect(phoneDigits('901 123 45 67')).toBe('79011234567');
  });

  it('keeps an existing 7 prefix untouched', () => {
    expect(phoneDigits('77012345678')).toBe('77012345678');
  });

  it('truncates to 11 digits', () => {
    expect(phoneDigits('7777123456789999')).toBe('77771234567');
  });

  it('returns an empty string when there are no digits', () => {
    expect(phoneDigits('')).toBe('');
    expect(phoneDigits('abc-()')).toBe('');
  });
});

describe('formatPhoneDisplay', () => {
  it('returns an empty string for empty input', () => {
    expect(formatPhoneDisplay('')).toBe('');
    expect(formatPhoneDisplay('---')).toBe('');
  });

  it('groups a full number as +7 777 123 45 67', () => {
    expect(formatPhoneDisplay('77771234567')).toBe('+7 777 123 45 67');
  });

  it('formats partial input while typing', () => {
    expect(formatPhoneDisplay('7')).toBe('+7');
    expect(formatPhoneDisplay('777')).toBe('+7 77');
    expect(formatPhoneDisplay('7777')).toBe('+7 777');
    expect(formatPhoneDisplay('77771')).toBe('+7 777 1');
    expect(formatPhoneDisplay('7777123')).toBe('+7 777 123');
    expect(formatPhoneDisplay('777712345')).toBe('+7 777 123 45');
  });

  it('normalizes a trunk-prefixed number before formatting', () => {
    expect(formatPhoneDisplay('87771234567')).toBe('+7 777 123 45 67');
  });
});

describe('isPhoneComplete', () => {
  it('is true only for 11 digit numbers', () => {
    expect(isPhoneComplete('+7 777 123 45 67')).toBe(true);
    expect(isPhoneComplete('8 777 123 45 67')).toBe(true);
    expect(isPhoneComplete('777 123 45 6')).toBe(false);
    expect(isPhoneComplete('')).toBe(false);
  });
});
