export type RenderQualityTier = 'low' | 'medium' | 'high';

export interface RenderQualityProfile {
  tier: RenderQualityTier;
  maxPixelRatio: number;
  shadowMapSize: number;
  /** false picks a single-tap shadow filter — much cheaper than PCF-soft on weak GPUs. */
  shadowSoft: boolean;
  /** Renderer-level MSAA. Off on low tier: the composer is already off there too, so
   *  there is no AA-quality tradeoff being made, only a GPU cost being avoided. */
  antialias: boolean;
  useComposer: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  exposure: number;
  /** Min bounding-box dimension (m) below which a shadow caster is demoted
   *  to non-casting — see `demoteSmallShadowCasters` in BaseLevelScene. Higher
   *  on `low` to cut more small casters out of the shadow pass on weak GPUs. */
  shadowCasterMinHeight: number;
}

function normalizeTier(raw: string | null): RenderQualityTier | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'low' || v === 'l') return 'low';
  if (v === 'medium' || v === 'med' || v === 'm') return 'medium';
  if (v === 'high' || v === 'h') return 'high';
  return null;
}

/**
 * Cheap, best-effort signal that a phone is low-end: `deviceMemory` and
 * `hardwareConcurrency` are the only device hints the web gives us without a
 * benchmark. Kept mobile-only — plenty of desktops/laptops report 4 cores
 * too, and those are not the devices this is meant to catch.
 */
function isWeakMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem > 0 && mem <= 3) return true;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0 && cores <= 4) return true;
  return false;
}

export function resolveRenderQualityTier(isMobile: boolean): RenderQualityTier {
  if (typeof window === 'undefined') return isMobile ? 'medium' : 'high';
  const fromUrl = normalizeTier(new URLSearchParams(window.location.search).get('quality'));
  if (fromUrl) return fromUrl;
  if (isMobile && isWeakMobileDevice()) return 'low';
  return isMobile ? 'medium' : 'high';
}

export function getRenderQualityProfile(tier: RenderQualityTier, isMobile: boolean): RenderQualityProfile {
  if (tier === 'low') {
    return {
      tier,
      maxPixelRatio: 1,
      shadowMapSize: 512,
      shadowSoft: false,
      antialias: false,
      useComposer: false,
      bloomStrength: 0.12,
      bloomRadius: 0.28,
      bloomThreshold: 0.9,
      exposure: 0.96,
      shadowCasterMinHeight: 1.0,
    };
  }
  if (tier === 'medium') {
    return {
      tier,
      maxPixelRatio: isMobile ? 1.25 : 1.5,
      shadowMapSize: 1024,
      shadowSoft: true,
      antialias: true,
      useComposer: !isMobile,
      bloomStrength: 0.2,
      bloomRadius: 0.34,
      bloomThreshold: 0.84,
      exposure: isMobile ? 1.0 : 1.08,
      shadowCasterMinHeight: 0.5,
    };
  }
  return {
    tier,
    maxPixelRatio: isMobile ? 1.5 : 2,
    shadowMapSize: isMobile ? 1024 : 2048,
    shadowSoft: true,
    antialias: true,
    useComposer: !isMobile,
    bloomStrength: 0.28,
    bloomRadius: 0.42,
    bloomThreshold: 0.78,
    exposure: isMobile ? 1.02 : 1.12,
    shadowCasterMinHeight: 0.5,
  };
}
