import { describe, expect, it } from 'vitest';
import {
  LEVEL_CONFIGS,
  getChapterProgress,
  getLevelConfig,
  getLevelsByChapter,
} from '@/utils/levels';

describe('LEVEL_CONFIGS', () => {
  it('exposes 60 levels with sequential ids', () => {
    expect(LEVEL_CONFIGS).toHaveLength(60);
    LEVEL_CONFIGS.forEach((level, index) => expect(level.id).toBe(index));
  });

  it('gives every level a positive star reward and both narratives', () => {
    for (const level of LEVEL_CONFIGS) {
      expect(level.reward.stars).toBeGreaterThan(0);
      expect(level.narrative.ru.length).toBeGreaterThan(0);
      expect(level.narrative.kk.length).toBeGreaterThan(0);
      expect(level.duration).toBeGreaterThan(0);
    }
  });

  it('derives the chapter from the level id', () => {
    for (const level of LEVEL_CONFIGS) {
      expect(level.chapter).toBe(Math.floor(level.id / 10) + 1);
    }
  });
});

describe('getLevelConfig', () => {
  it('returns the level with the given id', () => {
    expect(getLevelConfig(0)?.title).toBe('Первое утро');
    expect(getLevelConfig(9)?.reward.friend).toBe('rare_friend_1');
  });

  it('returns undefined for an unknown id', () => {
    expect(getLevelConfig(-1)).toBeUndefined();
    expect(getLevelConfig(LEVEL_CONFIGS.length)).toBeUndefined();
  });
});

describe('getLevelsByChapter', () => {
  it('returns the ten levels of a chapter', () => {
    const chapter2 = getLevelsByChapter(2);
    expect(chapter2.map((l) => l.id)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('returns an empty list for a chapter that does not exist', () => {
    expect(getLevelsByChapter(99)).toEqual([]);
  });
});

describe('getChapterProgress', () => {
  it('reports zero progress when nothing is completed', () => {
    expect(getChapterProgress(1, [])).toEqual({ total: 10, completed: 0, percentage: 0 });
  });

  it('counts only levels belonging to the chapter', () => {
    expect(getChapterProgress(1, [0, 1, 2, 15, 42])).toEqual({
      total: 10,
      completed: 3,
      percentage: 30,
    });
  });

  it('rounds the percentage', () => {
    expect(getChapterProgress(1, [0, 1, 2, 3, 4, 5]).percentage).toBe(60);
  });

  it('reports full completion', () => {
    const ids = getLevelsByChapter(2).map((l) => l.id);
    expect(getChapterProgress(2, ids)).toEqual({ total: 10, completed: 10, percentage: 100 });
  });

  it('reports empty totals for an unknown chapter', () => {
    const progress = getChapterProgress(99, [1]);
    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(Number.isNaN(progress.percentage)).toBe(true);
  });
});
