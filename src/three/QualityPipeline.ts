import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export type QualityOptions = {
  /** Мягкое свечение для светящихся предметов и окон. Держим слабым ради читаемости интерфейса. */
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  exposure?: number;
  /** На сенсорных устройствах и слабых видеокартах используем прямое сглаживание MSAA. */
  mobile?: boolean;
};

/**
 * Общий «премиальный кадр» для уровней Барсика: ACES везде, лёгкое свечение и
 * FXAA через EffectComposer на десктопе. На геймплей не влияет — только на
 * итоговую картинку.
 */
export class QualityPipeline {
  readonly composer: EffectComposer | null;
  private readonly bloom: UnrealBloomPass | null;
  private readonly fxaa: ShaderPass | null;
  private readonly size = new THREE.Vector2();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    opts: QualityOptions = {},
  ) {
    const mobile = opts.mobile ?? false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = opts.exposure ?? (mobile ? 1.0 : 1.12);

    // На мобильных уже включено MSAA самого отрисовщика. Не выделяем буферы
    // композитора и не гоняем полноэкранные проходы FXAA и вывода каждый кадр.
    if (mobile) {
      this.composer = null;
      this.bloom = null;
      this.fxaa = null;
      return;
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      opts.bloomStrength ?? 0.28,
      opts.bloomRadius ?? 0.42,
      opts.bloomThreshold ?? 0.78,
    );
    this.composer.addPass(this.bloom);
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
    this.composer.addPass(new OutputPass());
  }

  setSize(width: number, height: number) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.size.set(w, h);
    this.composer?.setSize(w, h);
    this.bloom?.setSize(w, h);
    if (!this.fxaa) return;
    const pixelRatio = this.renderer.getPixelRatio();
    this.fxaa.material.uniforms['resolution'].value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.composer?.dispose();
  }
}
