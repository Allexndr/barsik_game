import * as THREE from 'three';

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const ACTION_KEYS = ['KeyE', 'Space'];

/** WASD/arrows + on-screen joystick, shared by the third-person story levels. */
export class PlayerInput {
  private keys = new Set<string>();
  private joy = { x: 0, y: 0 };
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor(onAction: () => void) {
    this.onKeyDown = (e) => {
      this.keys.add(e.code);
      if (ACTION_KEYS.includes(e.code)) {
        e.preventDefault();
        onAction();
      }
      if (MOVE_KEYS.includes(e.code)) e.preventDefault();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
  }

  setJoystick(x: number, y: number) {
    this.joy = { x, y };
  }

  /** Combined keyboard + joystick direction, clamped to unit length. */
  direction() {
    let x = this.joy.x;
    let z = this.joy.y;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    const v = new THREE.Vector2(x, z);
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  dispose() {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }
}
