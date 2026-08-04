import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

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
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDraco());
  return loader;
}
