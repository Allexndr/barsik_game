import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { gameLoadingManager } from './loadProgress';

/** Shared Draco decoder (Meshy/opt GLBs require KHR_draco_mesh_compression). */
let sharedDraco: DRACOLoader | null = null;

function getDraco(): DRACOLoader {
  if (!sharedDraco) {
    sharedDraco = new DRACOLoader();
    sharedDraco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  }
  return sharedDraco;
}

/** Always use this instead of `new GLTFLoader()` for game assets. */
export function createGameGltfLoader(): GLTFLoader {
  // Shared manager so the loading screen can show real progress instead of
  // an animation that measures nothing.
  const loader = new GLTFLoader(gameLoadingManager);
  loader.setDRACOLoader(getDraco());
  return loader;
}
