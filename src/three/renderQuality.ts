export type RenderQualityTier = 'low' | 'medium' | 'high';

export interface RenderQualityProfile {
  tier: RenderQualityTier;
  maxPixelRatio: number;
  shadowMapSize: number;
  /** false выбирает однопроходный фильтр теней — на слабых видеокартах он много дешевле мягкого PCF. */
  shadowSoft: boolean;
  /** Сглаживание на уровне отрисовщика. На низком качестве выключено: композитор там
   *  тоже выключен, поэтому качеством сглаживания никто не жертвует — экономится
   *  только нагрузка на видеокарту. */
  antialias: boolean;
  useComposer: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  exposure: number;
  /** Наименьший габарит в метрах, ниже которого объект перестаёт отбрасывать тень —
   *  см. `demoteSmallShadowCasters` в BaseLevelScene. На низком качестве значение
   *  выше, чтобы убрать из теневого прохода больше мелких объектов. */
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
 * Дешёвый и приблизительный признак слабого телефона: `deviceMemory` и
 * `hardwareConcurrency` — единственные подсказки об устройстве, которые веб даёт
 * без замеров производительности. Только для мобильных: четыре ядра сообщают и
 * многие настольные машины с ноутбуками, а ловить эта проверка должна не их.
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
