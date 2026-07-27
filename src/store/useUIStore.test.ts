import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '@/store/useUIStore';
import { LANG_KEY } from '@/i18n';

describe('useUIStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({
      currentScreen: 'welcome',
      activeTab: 'travel',
      showEpisode: false,
      episodeId: null,
      softGate: null,
      sessionPlayMs: 0,
      lang: 'ru',
      muted: false,
    });
  });

  it('switches screen and tab', () => {
    useUIStore.getState().setScreen('game');
    useUIStore.getState().setActiveTab('shop');
    expect(useUIStore.getState().currentScreen).toBe('game');
    expect(useUIStore.getState().activeTab).toBe('shop');
  });

  it('routes level 0 to the mission0 screen instead of the episode timer', () => {
    useUIStore.getState().startEpisode(0);
    const state = useUIStore.getState();
    expect(state.currentScreen).toBe('mission0');
    expect(state.showEpisode).toBe(false);
    expect(state.episodeId).toBeNull();
    expect(state.activeTab).toBe('travel');
  });

  it('opens and closes a regular episode', () => {
    useUIStore.getState().startEpisode(4);
    expect(useUIStore.getState()).toMatchObject({
      showEpisode: true,
      episodeId: 4,
      activeTab: 'episode',
    });

    useUIStore.getState().endEpisode();
    expect(useUIStore.getState()).toMatchObject({
      showEpisode: false,
      episodeId: null,
      activeTab: 'travel',
    });
  });

  it('opens and closes the soft gate', () => {
    useUIStore.getState().openSoftGate('phone_1min');
    expect(useUIStore.getState().softGate).toBe('phone_1min');
    useUIStore.getState().closeSoftGate();
    expect(useUIStore.getState().softGate).toBeNull();
  });

  it('accumulates session play time', () => {
    useUIStore.getState().addSessionPlayMs(1000);
    useUIStore.getState().addSessionPlayMs(500);
    expect(useUIStore.getState().sessionPlayMs).toBe(1500);
  });

  it('persists the language and syncs the document', () => {
    useUIStore.getState().setLang('kk');
    expect(useUIStore.getState().lang).toBe('kk');
    expect(localStorage.getItem(LANG_KEY)).toBe('kk');
    expect(document.documentElement.lang).toBe('kk');
    expect(document.title.length).toBeGreaterThan(0);
  });

  it('keeps the stored player language in sync', () => {
    localStorage.setItem('barsik_player', JSON.stringify({ id: 'p1', nick: 'aya', lang: 'ru' }));
    useUIStore.getState().setLang('kk');
    expect(JSON.parse(localStorage.getItem('barsik_player')!).lang).toBe('kk');
  });

  it('survives a corrupted stored player when switching language', () => {
    localStorage.setItem('barsik_player', 'broken');
    expect(() => useUIStore.getState().setLang('kk')).not.toThrow();
    expect(useUIStore.getState().lang).toBe('kk');
  });

  it('toggles and persists mute', () => {
    useUIStore.getState().toggleMuted();
    expect(useUIStore.getState().muted).toBe(true);
    expect(localStorage.getItem('barsik_muted')).toBe('1');

    useUIStore.getState().toggleMuted();
    expect(useUIStore.getState().muted).toBe(false);
    expect(localStorage.getItem('barsik_muted')).toBe('0');
  });
});
