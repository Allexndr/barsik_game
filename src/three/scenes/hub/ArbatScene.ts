import * as THREE from 'three';
import { BaseLevelScene, type BaseHud } from '../BaseLevelScene';
import { createBarsikAvatar, DEFAULT_LOOK, type BarsikAvatar, type AvatarPose } from '../../avatar/BarsikAvatar';
import { connectHub, type HubConnection, type HubPeer, type HubPose } from '@/net/hub';
import { renderChat } from '@/utils/safeChat';
import { createGameGltfLoader } from '../../createGameGltfLoader';
import {
  ARBAT, assemble, assembleGlow, buildAppleMonument, buildBench, buildEasel, buildFacade,
  buildFountain, buildGate, buildLamp, buildPaving, buildPigeon, buildPlanter, buildStall,
  buildTerrace, buildTree, GLOW_MATERIAL,
} from './arbatProps';
import type { DaySample } from '../../DayCycle';

/**
 * Арбат — первая локация общего хаба.
 *
 * Это не уровень: здесь нет задания, нельзя проиграть и некуда торопиться.
 * Ребёнок приходит сюда ходить, встречать других и болтать — как в Шараме или
 * Роблоксе. Поэтому и устройство другое: фаз нет, вместо них одна `hub`, а
 * вместо целей — соседи, которых присылает сеть.
 *
 * Наследуемся от `BaseLevelScene` не ради уровневой машинерии, а ради того,
 * что хабу нужно ровно то же: управление стиком и клавишами, камера на 360°,
 * коллайдеры, качество картинки и шаги. Написать это заново значило бы
 * скопировать тысячу строк и потом чинить их в двух местах.
 */

/** Ось променада: ребёнок идёт от входа вглубь улицы. */
const STREET_HALF_W = 9;
const STREET_FROM = 12;
const STREET_TO = -72;
const SPAWN_Z = 8;

export interface HubHud extends BaseHud {
  online: number;
  status: 'offline' | 'connecting' | 'online';
  locationRu: string;
  locationKk: string;
}

/** Табличка с именем над головой. Рисуется на канве — шрифт один на всех. */
function makeLabel(text: string, bg: string, fg: string, maxWidth = 420): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const pad = 22;
  const font = '600 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.font = font;
  const w = Math.min(maxWidth, Math.ceil(ctx.measureText(text).width) + pad * 2);
  canvas.width = w;
  canvas.height = 84;
  const c = canvas.getContext('2d')!;
  c.font = font;
  c.textBaseline = 'middle';
  c.fillStyle = bg;
  const r = 26;
  c.beginPath();
  c.moveTo(r, 0);
  c.arcTo(w, 0, w, 84, r);
  c.arcTo(w, 84, 0, 84, r);
  c.arcTo(0, 84, 0, 0, r);
  c.arcTo(0, 0, w, 0, r);
  c.fill();
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.fillText(text, w / 2, 45, w - pad * 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  sprite.scale.set((w / 84) * 0.62, 0.62, 1);
  return sprite;
}

function disposeSprite(s: THREE.Sprite) {
  s.material.map?.dispose();
  s.material.dispose();
}

/** Один сосед: аватар, имя и облачко реплики. */
interface RemotePlayer {
  avatar: BarsikAvatar;
  nameTag: THREE.Sprite;
  bubble: THREE.Sprite | null;
  bubbleKey: string;
  /** Куда едем: пакеты приходят десять раз в секунду, кадров шестьдесят. */
  target: THREE.Vector3;
  targetRy: number;
  pose: HubPose;
}

export class ArbatScene extends BaseLevelScene {
  private onHud: ((h: HubHud) => void) | null = null;
  private hub: HubConnection | null = null;
  private remotes = new Map<string, RemotePlayer>();
  private street: THREE.Mesh[] = [];
  private nightLights: THREE.Mesh | null = null;
  private pigeonPhase = 0;
  private myPose: HubPose = 'idle';
  private poseUntil = 0;

  protected currentPhase() {
    return 'hub';
  }

  /** В хабе «действие» — помахать. Ничего собирать и решать тут не надо. */
  tryInteract() {
    this.emote('wave');
  }

  emote(pose: HubPose) {
    this.myPose = pose;
    this.poseUntil = performance.now() + 2200;
  }

  say(chatId: number) {
    this.hub?.say(chatId);
  }

  sayText(text: string) {
    this.hub?.sayText(text);
  }

  peers(): HubPeer[] {
    return this.hub?.peers() ?? [];
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: HubHud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;

    this.setupLighting(0xdfe7ee, 0xfff4e2, 1.55, 0xfff2dc, 0x9c8d7a);
    this.scene.fog = new THREE.Fog(0xdfe7ee, 90, 260);
    this.setupSky();
    this.setupClouds(6, 30, 90);

    // Земля улицы плоская намеренно: это мостовая, а не поляна. Рельеф под
    // пешеходной зоной читался бы как брак укладки.
    this.groundHeightAt = () => 0;
    this.footstepSurface = 'stone';

    this.buildStreet();
    this.buildColliders();

    this.hero.position.set(0, 0, SPAWN_Z);
    this.scene.add(this.hero);
    await this.loadHero(createGameGltfLoader());

    this.hub = connectHub('arbat', {
      id: this.playerId(),
      name: this.nick,
      fur: DEFAULT_LOOK.fur,
      spots: DEFAULT_LOOK.spots,
      hoodie: DEFAULT_LOOK.hoodie,
    }, () => this.pushHud());

    this.activate(() => {
      this.setupQuality();
      this.bindKeys();
      this.resize();
      addEventListener('resize', this.resize);
      this.pushHud();
      this.loop();
    });
  }

  /**
   * Постоянный идентификатор игрока в сети.
   *
   * Не имя: два ребёнка могут назваться одинаково, и тогда presence сольёт их
   * в одного. Случайный ключ живёт в localStorage, поэтому вернувшийся ребёнок
   * остаётся собой, а личных данных в нём нет.
   */
  private playerId(): string {
    const KEY = 'barsik_hub_id';
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) return saved;
      const made = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem(KEY, made);
      return made;
    } catch {
      return 'p' + Math.random().toString(36).slice(2, 12);
    }
  }

  // ── Улица ────────────────────────────────────────────────────────────────

  private buildStreet() {
    const parts: THREE.BufferGeometry[] = [];
    const glow: THREE.BufferGeometry[] = [];

    parts.push(...buildPaving(STREET_HALF_W, STREET_FROM, STREET_TO));
    parts.push(...buildGate(STREET_FROM - 2, STREET_HALF_W + 1.2));

    // Дома по обе стороны. Ширина и цвет чередуются, иначе улица читается
    // как коридор из одинаковых коробок.
    const widths = [16, 12, 18, 14, 20, 13, 17];
    const hues = [ARBAT.facadeA, ARBAT.facadeB, ARBAT.facadeC];
    for (const side of [-1, 1] as const) {
      let z = STREET_FROM - 2;
      let i = side < 0 ? 0 : 3;
      while (z > STREET_TO + 6) {
        const w = widths[i % widths.length];
        parts.push(...buildFacade(
          side * (STREET_HALF_W + 7.5), z - w / 2, w, 13,
          3 + (i % 2), hues[i % hues.length], side, glow,
        ));
        z -= w + 1.2;
        i++;
      }
    }

    // Торец улицы — большой универмаг, как ЦУМ в конце настоящего Арбата.
    parts.push(...buildFacade(0, STREET_TO - 7, 34, 14, 4, ARBAT.facadeB, 1, glow));

    // Деревья двумя рядами и фонари по оси между ними.
    for (let z = STREET_FROM - 6; z > STREET_TO + 6; z -= 7.5) {
      for (const side of [-1, 1] as const) {
        parts.push(...buildTree(side * 7.3, z, 0.92 + ((z * 7) % 5) * 0.04));
      }
    }
    for (let z = STREET_FROM - 8, k = 0; z > STREET_TO + 6; z -= 12, k++) {
      parts.push(...buildLamp(k % 2 ? 5.6 : -5.6, z, glow));
    }

    // Мебель и достопримечательности по оси, с юга на север.
    parts.push(...buildFountain(0, -4, 3.2));
    for (const z of [-13, -17]) {
      parts.push(...buildBench(-3.4, z, Math.PI / 2));
      parts.push(...buildBench(3.4, z, -Math.PI / 2));
    }
    parts.push(...buildAppleMonument(0, -25));
    for (const z of [-21.5, -28.5]) parts.push(...buildPlanter(-3.6, z), ...buildPlanter(3.6, z));

    // Шеренга портретистов — примета Арбата, по которой его узнают.
    const canvasHues = [0x7a6a5c, 0x8d6f7a, 0x5f6f86, 0x7d7a5a, 0x6d5f7d];
    for (let i = 0; i < 5; i++) {
      parts.push(...buildEasel(-6.2, -33 - i * 3.1, Math.PI / 2 + 0.12, canvasHues[i]));
    }
    // Напротив — сувенирные лотки.
    for (let i = 0; i < 3; i++) {
      parts.push(...buildStall(6.0, -33.5 - i * 4.6, -Math.PI / 2,
        i % 2 ? ARBAT.awningAlt : ARBAT.awning));
    }

    // Пятачок музыканта: скамейки полукругом, чтобы было где слушать.
    for (const [bx, bz, ry] of [
      [-2.6, -48, 0.5], [2.6, -48, -0.5], [-2.6, -52, 2.6], [2.6, -52, -2.6],
    ] as const) {
      parts.push(...buildBench(bx, bz, ry));
    }

    parts.push(...buildTerrace(-6.6, -58, -1));
    parts.push(...buildTerrace(6.6, -58, 1));
    parts.push(...buildFountain(0, -64, 2.6));
    for (const z of [-61, -67]) parts.push(...buildPlanter(-4.2, z), ...buildPlanter(4.2, z));

    // Голуби. Их больше, чем людей, и именно они делают площадь живой.
    for (let i = 0; i < 22; i++) {
      const a = i * 2.399;
      const x = Math.cos(a) * (1.5 + (i % 7) * 1.1);
      const z = -6 - ((i * 13) % 58);
      parts.push(...buildPigeon(x, z, a));
    }

    this.street = [assemble(parts, 'arbat')];
    for (const m of this.street) this.scene.add(m);
    this.nightLights = assembleGlow(glow, 'arbat-lights');
    this.scene.add(this.nightLights);
  }

  /**
   * Столкновения.
   *
   * Строим по тем же числам, что и геометрию, а не «на глаз»: в хабе нет
   * задания, зато есть сто предметов, и ребёнок будет тереться о каждый.
   */
  private buildColliders() {
    // Стены домов — двумя длинными полосами, а не по дому: между домами
    // на настоящем Арбате нет проходов, и щель тут только сбивала бы.
    for (const side of [-1, 1] as const) {
      this.colliders.push({
        kind: 'aabb',
        x: side * (STREET_HALF_W + 7.5),
        z: (STREET_FROM + STREET_TO) / 2,
        halfW: 6.5,
        halfD: (STREET_FROM - STREET_TO) / 2 + 8,
      });
    }
    // Торец: дальше улицы ходить некуда.
    this.colliders.push({ kind: 'aabb', x: 0, z: STREET_TO - 7, halfW: 17, halfD: 7 });
    // Вход: назад к воротам тоже не выпускаем.
    this.colliders.push({ kind: 'aabb', x: 0, z: STREET_FROM + 4, halfW: 17, halfD: 3 });

    this.colliders.push({ kind: 'circle', x: 0, z: -4, r: 3.5 });
    this.colliders.push({ kind: 'circle', x: 0, z: -25, r: 2.6 });
    this.colliders.push({ kind: 'circle', x: 0, z: -64, r: 2.9 });

    for (const z of [-13, -17]) {
      this.colliders.push({ kind: 'circle', x: -3.4, z, r: 1.0 });
      this.colliders.push({ kind: 'circle', x: 3.4, z, r: 1.0 });
    }
    for (const [bx, bz] of [[-2.6, -48], [2.6, -48], [-2.6, -52], [2.6, -52]] as const) {
      this.colliders.push({ kind: 'circle', x: bx, z: bz, r: 1.0 });
    }
    for (let i = 0; i < 3; i++) {
      this.colliders.push({ kind: 'circle', x: 6.0, z: -33.5 - i * 4.6, r: 1.3 });
    }
    for (let i = 0; i < 5; i++) {
      this.colliders.push({ kind: 'circle', x: -6.2, z: -33 - i * 3.1, r: 0.6 });
    }
    for (const z of [-21.5, -28.5, -61, -67]) {
      this.colliders.push({ kind: 'circle', x: -3.6, z, r: 0.75 });
      this.colliders.push({ kind: 'circle', x: 3.6, z, r: 0.75 });
    }
    for (const side of [-1, 1] as const) {
      this.colliders.push({ kind: 'aabb', x: side * 5.4, z: -58, halfW: 2.0, halfD: 3.4 });
    }
    for (let z = STREET_FROM - 6; z > STREET_TO + 6; z -= 7.5) {
      for (const side of [-1, 1] as const) {
        this.colliders.push({ kind: 'circle', x: side * 7.3, z, r: 0.55 });
      }
    }
  }

  // ── Соседи ───────────────────────────────────────────────────────────────

  private syncRemotes(now: number) {
    const peers = this.hub?.peers() ?? [];
    const alive = new Set<string>();

    for (const peer of peers) {
      alive.add(peer.id);
      let r = this.remotes.get(peer.id);
      if (!r) {
        const avatar = createBarsikAvatar({
          height: 1.45,
          look: { ...DEFAULT_LOOK, fur: peer.fur, spots: peer.spots, hoodie: peer.hoodie },
        });
        avatar.root.position.set(peer.x, 0, peer.z);
        const nameTag = makeLabel(peer.name, 'rgba(28,34,42,0.82)', '#ffffff', 340);
        nameTag.position.set(0, 1.95, 0);
        avatar.root.add(nameTag);
        this.scene.add(avatar.root);
        r = {
          avatar, nameTag, bubble: null, bubbleKey: '',
          target: new THREE.Vector3(peer.x, 0, peer.z), targetRy: peer.ry, pose: peer.pose,
        };
        this.remotes.set(peer.id, r);
      }
      r.target.set(peer.x, 0, peer.z);
      r.targetRy = peer.ry;
      r.pose = peer.pose;

      // Реплика живёт пять секунд — дольше облачко превращается в вывеску.
      const fresh = peer.sayAt && now - peer.sayAt < 5000;
      const text = fresh
        ? (peer.sayText ?? (peer.sayId != null ? renderChat(peer.sayId, this.lang) : null))
        : null;
      const key = text ?? '';
      if (key !== r.bubbleKey) {
        if (r.bubble) { r.avatar.root.remove(r.bubble); disposeSprite(r.bubble); r.bubble = null; }
        if (text) {
          const b = makeLabel(text, 'rgba(255,255,255,0.94)', '#1c222a', 520);
          b.position.set(0, 2.55, 0);
          r.avatar.root.add(b);
          r.bubble = b;
        }
        r.bubbleKey = key;
      }
    }

    for (const [id, r] of this.remotes) {
      if (alive.has(id)) continue;
      if (r.bubble) disposeSprite(r.bubble);
      disposeSprite(r.nameTag);
      this.scene.remove(r.avatar.root);
      r.avatar.dispose();
      this.remotes.delete(id);
    }
  }

  private driveRemotes(dt: number, t: number) {
    // Пакеты приходят десять раз в секунду, кадров шестьдесят: без сглаживания
    // соседи телепортировались бы рывками по десять сантиметров.
    const k = 1 - Math.pow(0.0001, dt);
    for (const r of this.remotes.values()) {
      const p = r.avatar.root.position;
      const moved = p.distanceTo(r.target);
      p.lerp(r.target, k);
      const ry = r.avatar.root.rotation.y;
      let d = r.targetRy - ry;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      r.avatar.root.rotation.y = ry + d * k;
      const pose: AvatarPose = r.pose === 'walk' && moved < 0.02 ? 'idle' : (r.pose as AvatarPose);
      if (r.avatar.currentPose() !== pose) r.avatar.setPose(pose);
      r.avatar.update(dt, t, moved > 0.02 ? 1 : 0);
    }
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    const t = now * 0.001;

    const before = this.hero.position.clone();
    this.updateMovement(dt, true, this.runSpeed, -STREET_HALF_W, STREET_HALF_W, STREET_TO + 4, STREET_FROM + 2);
    const moved = this.hero.position.distanceTo(before) > 0.004;

    // Эмоция держится пару секунд и уступает ходьбе: ребёнок машет и идёт
    // дальше, а не залипает в позе до следующего нажатия.
    if (now > this.poseUntil) this.myPose = moved ? 'walk' : 'idle';
    else if (moved && this.myPose !== 'wave') this.myPose = 'walk';

    this.hub?.move(
      +this.hero.position.x.toFixed(2),
      +this.hero.position.z.toFixed(2),
      +this.hero.rotation.y.toFixed(2),
      this.myPose,
    );

    this.syncRemotes(now);
    this.driveRemotes(dt, t);

    this.pigeonPhase += dt;

    const f = this.cameraFraming();
    const target = new THREE.Vector3(
      this.cameraLateral(this.hero.position.x) + f.lateral,
      6.4 * f.heightMul,
      this.hero.position.z + 9.0 + f.backAdd,
    );
    this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
    this.camera.lookAt(this.hero.position.x - f.lateral * 0.28, 1.5 + f.lookUp, this.hero.position.z - 0.8);

    this.renderFrame();
  };

  /**
   * Окна и фонари зажигаются вместе с сумерками.
   *
   * Материал огней общий на всю улицу, поэтому это одна строка на кадр — но
   * именно она превращает ночной Арбат из тёмного коридора в улицу, по
   * которой хочется идти.
   */
  protected applyDay(s: DaySample) {
    super.applyDay(s);
    GLOW_MATERIAL.opacity = s.lampsOn;
    if (this.nightLights) this.nightLights.visible = s.lampsOn > 0.02;
  }

  private pushHud() {
    const online = (this.hub?.peers().length ?? 0) + 1;
    const status = this.hub?.status() ?? 'offline';
    this.onHud?.({
      phase: 'hub',
      speaker: 'Барсик',
      line: '',
      objective: '',
      stars: 0,
      canInteract: false,
      showMoveHint: false,
      showActionHint: false,
      outro: false,
      online,
      status,
      locationRu: 'Арбат',
      locationKk: 'Арбат',
    });
  }

  dispose() {
    GLOW_MATERIAL.opacity = 0;
    this.hub?.leave();
    this.hub = null;
    for (const r of this.remotes.values()) {
      if (r.bubble) disposeSprite(r.bubble);
      disposeSprite(r.nameTag);
      r.avatar.dispose();
    }
    this.remotes.clear();
    super.dispose();
  }
}
