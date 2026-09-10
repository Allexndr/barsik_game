import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { gameLoadingManager } from './loadProgress';

/** Общий декодер Draco: оптимизированным GLB из Meshy нужен KHR_draco_mesh_compression. */
let sharedDraco: DRACOLoader | null = null;

function getDraco(): DRACOLoader {
  if (!sharedDraco) {
    sharedDraco = new DRACOLoader();
    sharedDraco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  }
  return sharedDraco;
}

/** Для игровых ассетов всегда использовать это вместо `new GLTFLoader()`. */
export function createGameGltfLoader(): GLTFLoader {
  // Общий менеджер, чтобы экран загрузки показывал настоящий прогресс, а не
  // анимацию, которая ничего не измеряет.
  const loader = new GLTFLoader(gameLoadingManager);
  loader.setDRACOLoader(getDraco());
  return loader;
}
