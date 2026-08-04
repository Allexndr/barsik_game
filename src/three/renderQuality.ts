export type RenderQualityTier = 'low' | 'medium' | 'high';

export interface RenderQualityProfile {
  tier: RenderQualityTier;
  maxPixelRatio: number;
  shadowMapSize: number;
  useComposer: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  exposure: number;
}

function normalizeTier(raw: string | null): RenderQualityTier | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'low' || v === 'l') return 'low';
  if (v === 'medium' || v === 'med' || v === 'm') return 'medium';
  if (v === 'high' || v === 'h') return 'high';
  return null;
}

export function resolveRenderQualityTier(isMobile: boolean): RenderQualityTier {
  if (typeof window === 'undefined') return isMobile ? 'medium' : 'high';
  const fromUrl = normalizeTier(new URLSearchParams(window.location.search).get('quality'));
  if (fromUrl) return fromUrl;
  return isMobile ? 'medium' : 'high';
}

export function getRenderQualityProfile(tier: RenderQualityTier, isMobile: boolean): RenderQualityProfile {
  if (tier === 'low') {
    return {
      tier,
      maxPixelRatio: 1,
      shadowMapSize: 512,
      useComposer: false,
      bloomStrength: 0.12,
      bloomRadius: 0.28,
      bloomThreshold: 0.9,
      exposure: 0.96,
    };
  }
  if (tier === 'medium') {
    return {
      tier,
      maxPixelRatio: isMobile ? 1.25 : 1.5,
      shadowMapSize: 1024,
      useComposer: !isMobile,
      bloomStrength: 0.2,
      bloomRadius: 0.34,
      bloomThreshold: 0.84,
      exposure: isMobile ? 1.0 : 1.08,
    };
  }
  return {
    tier,
    maxPixelRatio: isMobile ? 1.5 : 2,
    shadowMapSize: isMobile ? 1024 : 2048,
    useComposer: !isMobile,
    bloomStrength: 0.28,
    bloomRadius: 0.42,
    bloomThreshold: 0.78,
    exposure: isMobile ? 1.02 : 1.12,
  };
}
