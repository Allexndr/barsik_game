import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVEL_CONFIGS } from '@/utils/levels';

const sql = readFileSync(new URL('../supabase/progression.sql', import.meta.url), 'utf8');

describe('server progression SQL contract', () => {
  it('keeps every configured friend reward represented in the RPC', () => {
    for (const level of LEVEL_CONFIGS) {
      if (!level.reward.friend) continue;
      expect(sql).toContain(`when ${level.id} then '${level.reward.friend}'`);
    }
  });
});
