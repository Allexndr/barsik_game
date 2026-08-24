import * as THREE from 'three';
import { ARBAT } from './arbatProps';

/**
 * Живой слой фонтана: вода с рябью и настоящие подпрыгивающие капли.
 *
 * Чаша и постамент — `buildFountain` в `arbatProps.ts` — стоят в общем слитом
 * меше локации и в кадре бесплатны. Но вода в том меше не может двигаться:
 * слияние запекает геометрию раз и навсегда. Поэтому она — отдельная группа,
 * которую сцена обновляет каждый кадр, ровно как аттракционы в `rides.ts`.
 *
 * Не аттракцион: сесть на него нельзя, `HubScene` просто вызывает `update`
 * для каждого фонтана локации без всякого участия игрока.
 */

export interface FountainFx {
  x: number;
  z: number;
  /** Радиус чаши — не для отрисовки, а чтобы внешний код (проверки, зонды) знал её физический охват. */
  r: number;
  group: THREE.Group;
  update(dt: number, t: number): void;
  dispose(): void;
}

/**
 * Поверхность воды: концентрическая рябь от центра, шейдер вместо текстуры.
 *
 * Тайлящаяся текстура здесь не подойдёт — круг фонтана слишком мал, чтобы
 * скрыть повтор, а рябь должна расходиться именно от центральной струи, а не
 * плыть в одну сторону, как WindGrass на лугу. `#include <colorspace_fragment>`
 * обязателен: тот же промах уже дважды случался в проекте — на траве и на
 * небе, — когда собственный шейдер писал линейный цвет туда, где движок ждёт
 * sRGB.
 */
function createWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(ARBAT.water) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        if (r > 1.0) discard;
        // Три кольца ряби на разных фазах, расходящиеся от центра.
        float ring = 0.0;
        ring += sin(r * 22.0 - uTime * 2.6) * 0.5 + 0.5;
        ring += sin(r * 13.0 - uTime * 1.7 + 2.0) * 0.5 + 0.5;
        ring *= smoothstep(1.0, 0.15, r);
        vec3 col = uColor + ring * 0.05;
        // Край чаши темнее — глубина без единого дополнительного источника света.
        col *= mix(0.82, 1.0, smoothstep(1.0, 0.55, r));
        gl_FragColor = vec4(col, 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Одна капля.
 *
 * Летит по параболе от верхушки струи наружу и вниз, зациклена по времени
 * жизни; фаза у каждой своя, поэтому фонтан не рисует один и тот же кадр
 * восемь раз подряд.
 */
interface Droplet {
  mesh: THREE.Mesh;
  angle: number;
  outR: number;
  life: number;
  phase: number;
}

export function createFountainFx(x: number, z: number, r: number): FountainFx {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const waterMat = createWaterMaterial();
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.25, 24), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.51;
  group.add(water);

  const dropletMat = new THREE.MeshStandardMaterial({
    color: ARBAT.water, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.05, depthWrite: false,
  });
  const droplets: Droplet[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), dropletMat);
    group.add(mesh);
    droplets.push({
      mesh,
      angle: (i / N) * Math.PI * 2,
      outR: r * (0.5 + 0.35 * ((i * 7) % 5) / 4),
      life: 1.1 + ((i * 13) % 7) * 0.05,
      phase: (i / N) * 1.1,
    });
  }

  // Центральная струя: тонкий конус воды, пульсирует высотой вместе с каплями.
  const jetMat = new THREE.MeshStandardMaterial({
    color: ARBAT.water, transparent: true, opacity: 0.55, roughness: 0.1,
  });
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 1.0, 8), jetMat);
  jet.position.y = 1.9;
  group.add(jet);

  let clock = 0;

  return {
    x, z, r, group,
    update(dt, t) {
      void t;
      clock += dt;
      waterMat.uniforms.uTime.value = clock;

      const jetBob = Math.sin(clock * 3.1) * 0.06;
      jet.scale.y = 1 + jetBob;
      jet.position.y = 1.9 + jetBob * 0.5;

      for (const d of droplets) {
        const local = (clock * 0.7 + d.phase) % d.life;
        const p = local / d.life; // 0..1 по времени жизни этой капли
        // Взлёт по параболе: вверх и наружу, потом падение под собственной высотой.
        const up = 1.9 + Math.sin(p * Math.PI) * 0.85;
        const out = p * d.outR;
        d.mesh.position.set(Math.cos(d.angle) * out, up, Math.sin(d.angle) * out);
        // Материал капель общий на все четырнадцать — задавать прозрачность
        // через него означало бы, что последняя обработанная капля решает
        // альфу для всех остальных. Затухание в начале и в конце полёта
        // делаем масштабом: у собственной геометрии каждой капли он свой.
        const fade = Math.min(1, p / 0.08) * Math.min(1, (1 - p) / 0.15);
        d.mesh.scale.setScalar((1 - p * 0.35) * Math.max(0.001, fade));
      }
    },
    dispose() {
      water.geometry.dispose();
      waterMat.dispose();
      jet.geometry.dispose();
      jetMat.dispose();
      for (const d of droplets) d.mesh.geometry.dispose();
      dropletMat.dispose();
    },
  };
}
