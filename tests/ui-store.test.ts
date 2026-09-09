import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '../src/store/useUIStore';

describe('mission restart state', () => {
  beforeEach(() => {
    useUIStore.setState({
      currentScreen: 'welcome',
      showSettings: false,
      paused: false,
      episodeRunId: 0,
    });
  });

  it('creates a new run token when starting the same mission again', () => {
    const store = useUIStore.getState();

    store.startEpisode(1);
    expect(useUIStore.getState().currentScreen).toBe('mission1');
    const firstRun = useUIStore.getState().episodeRunId;

    useUIStore.getState().startEpisode(1);

    expect(useUIStore.getState().episodeRunId).toBe(firstRun + 1);
    expect(useUIStore.getState().paused).toBe(false);
    expect(useUIStore.getState().showSettings).toBe(false);
  });
});
