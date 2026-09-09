import { describe, expect, it } from 'vitest';
import { checkText } from '../src/utils/moderation';

describe('child-facing text moderation', () => {
  it('rejects contact details and links', () => {
    expect(checkText('Позвони 123456', { allowPunctuation: true }).ok).toBe(false);
    expect(checkText('https://example.com', { allowPunctuation: true }).ok).toBe(false);
  });

  it('allows ordinary bilingual names', () => {
    expect(checkText('Айсулу', { maxLength: 16 }).ok).toBe(true);
    expect(checkText('Barsik-7', { maxLength: 16 }).ok).toBe(true);
  });
});
