import * as THREE from 'three';
import { BaseLevelScene, type BaseHud } from '../BaseLevelScene';
import {
  createBarsikAvatar, DEFAULT_LOOK, type BarsikAvatar, type AvatarPose,
} from '../../avatar/BarsikAvatar';
import { connectHub, type HubConnection, type HubPeer, type HubPose } from '@/net/hub';
import { renderChat } from '@/utils/safeChat';
import { createGameGltfLoader } from '../../createGameGltfLoader';
import { assemble, assembleGlow, GLOW_MATERIAL } from './arbatProps';
import { arrivalPoint, getLocation, type HubLocation, type LocationId } from './locations';
import { pickSeat, type Ride } from './rides';
import type { DaySample } from '../../DayCycle';

/**
 * Общая сцена хаба.
 *
 * Одна на все локации: различаются они данными, а не кодом. Всё, что здесь
 * есть, нужно каждой — управление, соседи по сети, реплики над головой,
 * ночные огни и переходы в соседние места.
 *
 * Наследуемся от `BaseLevelScene` не ради уровневой машинерии, а ради
 * управления стиком и клавишами, камеры на 360°, коллайдеров и суточного
 * цикла. Писать это заново значило бы держать тысячу строк в двух местах.
 */

export interface HubHud extends BaseHud {
  online: number;
  status: 'offline' | 'connecting' | 'online';
  location: LocationId;
  locationRu: string;
  locationKk: string;
  /** Выход, у которого стоит ребёнок, — по нему рисуется подсказка перехода. */
  atPortal: { to: LocationId; ru: string; kk: string } | null;
  /** Аттракцион под рукой: подсказка «сесть» или «слезть». */
  atRide: { ru: string; kk: string; riding: boolean } | null;
}

/** Табличка над головой. Рисуется на канве — шрифт один на всех. */
function makeLabel(text: string, bg: string, fg: string, maxWidth = 420): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d')!;
  const pad = 22;
  const font = '600 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  measure.font = font;
  const w = Math.min(maxWidth, Math.ceil(measure.measureText(text).width) + pad * 2);
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

interface RemotePlayer {
  avatar: BarsikAvatar;
  nameTag: THREE.Sprite;
  bubble: THREE.Sprite | null;
  bubbleKey: string;
  target: THREE.Vector3;
  targetRy: number;
  pose: HubPose;
}

export class HubScene extends BaseLevelScene {
  private onHud: ((h: HubHud) => void) | null = null;
  private hub: HubConnection | null = null;
  private remotes = new Map<string, RemotePlayer>();
  private nightLights: THREE.Mesh | null = null;
  private place: HubLocation | null = null;
  private myPose: HubPose = 'idle';
  private poseUntil = 0;
  private atPortal: HubHud['atPortal'] = null;
  private onTravel: ((to: LocationId) => void) | null = null;
  private travelArmed = false;
  private rides: Ride[] = [];
  private nearRide: Ride | null = null;
  private ridingOn: Ride | null = null;
  private ridingSeat = -1;
  private seatPos = new THREE.Vector3();

  protected currentPhase() {
    return 'hub';
  }

  /**
   * Действие в хабе.
   *
   * Порядок важен: сидящий ребёнок должен уметь слезть первым же нажатием, и
   * никакая арка рядом не должна у него это отобрать.
   */
  tryInteract() {
    if (this.ridingOn) {
      this.dismount();
      return;
    }
    if (this.nearRide) {
      this.mount(this.nearRide);
      return;
    }
    if (this.atPortal && this.onTravel) {
      this.onTravel(this.atPortal.to);
      return;
    }
    this.emote('wave');
  }

  private mount(ride: Ride) {
    const seat = pickSeat(ride, this.hero.position);
    if (seat < 0) return;
    ride.occupied[seat] = 'me';
    this.ridingOn = ride;
    this.ridingSeat = seat;
    this.myPose = 'sit';
    this.poseUntil = Infinity;
    this.pushHud();
  }

  private dismount() {
    const ride = this.ridingOn;
    if (!ride) return;
    ride.occupied[this.ridingSeat] = null;
    this.ridingOn = null;
    this.ridingSeat = -1;
    this.poseUntil = 0;
    this.myPose = 'idle';
    // Ставим рядом, а не на месте сиденья: иначе ребёнок оказывается внутри
    // конструкции и первым же шагом упирается в её коллайдер.
    const dx = this.hero.position.x - ride.x;
    const dz = this.hero.position.z - ride.z;
    const d = Math.hypot(dx, dz) || 1;
    this.hero.position.set(ride.x + (dx / d) * (ride.r + 0.6), 0, ride.z + (dz / d) * (ride.r + 0.6));
    this.pushHud();
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

  async init(
    nick: string,
    lang: 'ru' | 'kk',
    onHud: (h: HubHud) => void,
    locationId: LocationId = 'arbat',
    cameFrom: LocationId | null = null,
    onTravel?: (to: LocationId) => void,
  ) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    this.onTravel = onTravel ?? null;

    const place = getLocation(locationId);
    if (!place) throw new Error(`неизвестная локация: ${locationId}`);
    this.place = place;

    this.setupLighting(0xdfe7ee, 0xfff4e2, 1.55, 0xfff2dc, 0x9c8d7a);
    this.setupSky();
    this.setupClouds(6, 30, 90);

    // Земля хаба плоская намеренно: это мостовая и парковые дорожки, а не
    // поляна. Рельеф под ними читался бы браком укладки.
    this.groundHeightAt = () => 0;
    this.footstepSurface = place.surface;

    const built = place.build();
    this.scene.add(assemble(built.solid, `hub-${place.id}`));
    this.nightLights = assembleGlow(built.glow, `hub-${place.id}-lights`);
    this.scene.add(this.nightLights);
    for (const c of built.colliders) this.colliders.push(c);

    this.rides = place.rides?.() ?? [];
    for (const ride of this.rides) this.scene.add(ride.group);

    const at = arrivalPoint(place, cameFrom);
    this.hero.position.set(at.x, 0, at.z);
    this.scene.add(this.hero);
    await this.loadHero(createGameGltfLoader());

    // Приходя из соседнего места, нельзя тут же провалиться обратно: портал
    // взводится, только когда ребёнок от неё отошёл.
    this.travelArmed = cameFrom === null;

    this.hub = connectHub(place.id, {
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
   * Постоянный ключ игрока в сети.
   *
   * Не имя: два ребёнка могут назваться одинаково, и presence сольёт их в
   * одного. Случайная строка живёт в localStorage, личных данных в ней нет.
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

      // Реплика живёт пять секунд: дольше облачко превращается в вывеску.
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
    // соседи ехали бы рывками.
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

  // ── Переходы ─────────────────────────────────────────────────────────────

  private checkPortals() {
    const place = this.place;
    if (!place) return;
    const p = this.hero.position;
    let near: HubHud['atPortal'] = null;
    let nearest = Infinity;
    for (const portal of place.portals) {
      const d = Math.hypot(p.x - portal.x, p.z - portal.z);
      if (d < portal.r && d < nearest) {
        nearest = d;
        near = { to: portal.to, ru: portal.ru, kk: portal.kk };
      }
    }
    // Пока ребёнок не отошёл от арки, через которую вошёл, переход не
    // предлагаем — иначе вход и выход сливаются в мигающую кнопку.
    if (!near) this.travelArmed = true;
    const shown = this.travelArmed ? near : null;
    if (shown?.to !== this.atPortal?.to) {
      this.atPortal = shown;
      this.pushHud();
    }
  }

  private checkRides() {
    if (this.ridingOn) {
      if (this.nearRide) { this.nearRide = null; this.pushHud(); }
      return;
    }
    const p = this.hero.position;
    let best: Ride | null = null;
    let bestD = Infinity;
    for (const ride of this.rides) {
      const d = Math.hypot(p.x - ride.x, p.z - ride.z);
      // Аттракцион, где все места заняты, не предлагаем: подсказка, по
      // которой ничего не происходит, хуже её отсутствия.
      if (d < ride.r && d < bestD && ride.occupied.some((o) => !o)) {
        bestD = d;
        best = ride;
      }
    }
    if (best !== this.nearRide) {
      this.nearRide = best;
      this.pushHud();
    }
  }

  // ── Кадр ─────────────────────────────────────────────────────────────────

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    const t = now * 0.001;
    const b = this.place?.bounds ?? { xMin: -40, xMax: 40, zMin: -80, zMax: 20 };

    // Аттракционы крутятся всегда, а не только когда на них сидят: пустая
    // карусель, замершая намертво, читается сломанной.
    for (const ride of this.rides) ride.update(dt, t);

    const before = this.hero.position.clone();
    const riding = this.ridingOn;
    if (riding) {
      // Сидя ребёнок не ходит: его везёт аттракцион. Координаты при этом
      // уходят в сеть как обычно, поэтому соседи видят, что он катается,
      // и синхронизировать сам аттракцион не нужно.
      const ry = riding.seatAt(this.ridingSeat, this.seatPos);
      this.hero.position.copy(this.seatPos);
      this.hero.rotation.y = ry;
    } else {
      this.updateMovement(dt, true, this.runSpeed, b.xMin, b.xMax, b.zMin, b.zMax);
    }
    const moved = !riding && this.hero.position.distanceTo(before) > 0.004;

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

    this.checkPortals();
    this.checkRides();
    this.syncRemotes(now);
    this.driveRemotes(dt, t);

    const f = this.cameraFraming();
    // Сидя камера отходит и поднимается: иначе аттракцион, на котором едешь,
    // не помещается в кадр и катание превращается в тряску экрана.
    const back = riding ? 12.5 : 9.0;
    const high = riding ? 7.6 : 6.4;
    const target = new THREE.Vector3(
      this.cameraLateral(riding ? riding.x : this.hero.position.x) + f.lateral,
      high * f.heightMul,
      (riding ? riding.z : this.hero.position.z) + back + f.backAdd,
    );
    this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
    this.camera.lookAt(
      (riding ? riding.x : this.hero.position.x) - f.lateral * 0.28,
      1.5 + f.lookUp,
      (riding ? riding.z : this.hero.position.z) - 0.8,
    );

    this.renderFrame();
  };

  /**
   * Окна и фонари зажигаются вместе с сумерками.
   *
   * Материал огней общий на локацию, поэтому это одна строка на кадр — но
   * именно она превращает ночную улицу из тёмного коридора в место, по
   * которому хочется идти.
   */
  protected applyDay(s: DaySample) {
    super.applyDay(s);
    GLOW_MATERIAL.opacity = s.lampsOn;
    if (this.nightLights) this.nightLights.visible = s.lampsOn > 0.02;
  }

  private pushHud() {
    const online = (this.hub?.peers().length ?? 0) + 1;
    const status = this.hub?.status() ?? 'offline';
    const place = this.place;
    this.onHud?.({
      phase: 'hub',
      speaker: 'Барсик',
      line: '',
      objective: '',
      stars: 0,
      canInteract: this.atPortal !== null || this.nearRide !== null || this.ridingOn !== null,
      showMoveHint: false,
      showActionHint: this.atPortal !== null,
      outro: false,
      online,
      status,
      location: place?.id ?? 'arbat',
      locationRu: place?.ru ?? '',
      locationKk: place?.kk ?? '',
      atPortal: this.ridingOn || this.nearRide ? null : this.atPortal,
      atRide: this.ridingOn
        ? { ru: this.ridingOn.ru, kk: this.ridingOn.kk, riding: true }
        : this.nearRide
          ? { ru: this.nearRide.ru, kk: this.nearRide.kk, riding: false }
          : null,
    });
  }

  dispose() {
    for (const ride of this.rides) ride.dispose();
    this.rides = [];
    this.ridingOn = null;
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
