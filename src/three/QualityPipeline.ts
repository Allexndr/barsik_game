import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export type QualityOptions = {
  /** Soft bloom for emissive collectibles / windows. Keep low for kids UI readability. */
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  exposure?: number;
  /** Use direct MSAA rendering on coarse-pointer / weak GPUs. */
  mobile?: boolean;
};

/**
 * Shared “premium frame” for Barsik levels:
 * ACES everywhere; subtle bloom + FXAA via EffectComposer on desktop.
 * Does not change gameplay — only the final look.
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

    // Mobile already uses renderer MSAA. Avoid allocating composer render targets
    // and running full-screen FXAA/Output passes on every frame.
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
