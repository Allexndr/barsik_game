import * as THREE from 'three';
import {
  reportLoadComplete,
  reportLoadError,
  reportLoadProgress,
} from './loadProgressState';

export {
  onLoadProgress,
  resetLoadProgress,
  setLoadProgressLang,
} from './loadProgressState';
export type { LoadProgress } from './loadProgressState';

/** Общий менеджер Three.js; состояние для интерфейса живёт в модуле без Three. */
export const gameLoadingManager = new THREE.LoadingManager();

gameLoadingManager.onProgress = (url, loaded, total) => {
  reportLoadProgress(url, loaded, total);
};

gameLoadingManager.onLoad = () => reportLoadComplete();
gameLoadingManager.onError = (url) => reportLoadError(url);
