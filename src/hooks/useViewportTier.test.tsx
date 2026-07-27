import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useViewportTier, type ViewportTier } from '@/hooks/useViewportTier';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderTier(): { current: ViewportTier | null } {
  const result: { current: ViewportTier | null } = { current: null };
  function Probe() {
    result.current = useViewportTier();
    return null;
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Probe />);
  });
  return result;
}

function resizeTo(width: number) {
  act(() => {
    window.innerWidth = width;
    window.dispatchEvent(new Event('resize'));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  window.innerWidth = 1024;
});

describe('useViewportTier', () => {
  it.each<[number, ViewportTier]>([
    [320, 'phone'],
    [767, 'phone'],
    [768, 'tablet'],
    [1099, 'tablet'],
    [1100, 'desktop'],
    [1920, 'desktop'],
  ])('reports %i px as %s', (width, expected) => {
    window.innerWidth = width;
    expect(renderTier().current).toBe(expected);
  });

  it('updates on resize', () => {
    window.innerWidth = 400;
    const tier = renderTier();
    expect(tier.current).toBe('phone');

    resizeTo(1200);
    expect(tier.current).toBe('desktop');

    resizeTo(800);
    expect(tier.current).toBe('tablet');
  });

  it('stops listening after unmount', () => {
    window.innerWidth = 400;
    const tier = renderTier();
    act(() => root!.unmount());
    root = null;
    resizeTo(1200);
    expect(tier.current).toBe('phone');
  });
});
