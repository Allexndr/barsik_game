/**
 * По одному лицу на друга, нарисованному в SVG.
 *
 * Экран коллекции показывал всем девяти один и тот же значок лапы — и открытым, и
 * закрытым, — то есть экран, вся работа которого «смотри, что у тебя есть и чего
 * не хватает», показывал девять одинаковых плиток. Коллекция, где все предметы
 * выглядят одинаково, — не коллекция.
 *
 * SVG, а не отрисовка GLB: девять полотен WebGL на мета-экране — многовато
 * контекстов ради девяти миниатюр, каждый GLB весит мегабайты, а у половины
 * состава модели нет вовсе. Эти дёшевы, чётки на любом размере и — что полезнее
 * всего — остаются узнаваемым персонажем, даже когда сплющены в силуэт, а именно
 * силуэтом и должна быть закрытая ячейка.
 */

type Ears = 'round' | 'pointed' | 'tufted' | 'none';

interface FriendFace {
  /** Заливка головы; закрытый силуэт этот цвет игнорирует. */
  fur: string;
  /** Морда, щёки, светлое пятно на животе. */
  light: string;
  ears: Ears;
  eye: string;
  /** Ширина головы относительно высоты: снеговик круглый, лис узкий. */
  aspect: number;
  markings?: 'spots' | 'spikes' | 'stitches' | 'none';
  hat?: 'cap' | 'leaf' | 'bucket' | 'hood' | 'none';
  hatColor?: string;
  accent?: string;
  nose?: 'button' | 'carrot' | 'none';
  beard?: boolean;
}

const FACES: Record<string, FriendFace> = {
  gardener: {
    fur: '#f3c9a0', light: '#ffe4c8', ears: 'none', eye: '#4a6fa5', aspect: 0.86,
    hat: 'cap', hatColor: '#3f8f4f', accent: '#8d6e63', nose: 'button',
  },
  aya: {
    fur: '#f3efe8', light: '#fffdf9', ears: 'round', eye: '#5aa9e6', aspect: 0.98,
    markings: 'spots', accent: '#f2a2c0', nose: 'button',
  },
  hedgehog: {
    fur: '#b98d5f', light: '#f0dcc0', ears: 'round', eye: '#3d2b20', aspect: 0.94,
    markings: 'spikes', accent: '#6d4c41', nose: 'button',
  },
  squirrel: {
    fur: '#d97b3a', light: '#ffe0bd', ears: 'tufted', eye: '#3d2b20', aspect: 0.9,
    accent: '#a75521', nose: 'button',
  },
  putalo: {
    fur: '#cdae7a', light: '#e8d5a8', ears: 'none', eye: '#ffd54f', aspect: 0.92,
    markings: 'stitches', hat: 'leaf', hatColor: '#5c8f34', accent: '#7d5b2b', nose: 'none',
  },
  yagodka_rare: {
    fur: '#e46aa0', light: '#ffd3e6', ears: 'round', eye: '#5c2b4a', aspect: 0.96,
    accent: '#59b04a', nose: 'button',
  },
  ice_master: {
    fur: '#bcd8ea', light: '#e8f4fb', ears: 'none', eye: '#2f6f9f', aspect: 0.88,
    // Борода сине-серая, а не белая: на светло-голубой голове белая борода на
    // белом фоне была не видна.
    hat: 'hood', hatColor: '#3f6698', accent: '#8fb4d4', beard: true, nose: 'button',
  },
  snowman: {
    fur: '#f4f8fb', light: '#ffffff', ears: 'none', eye: '#37474f', aspect: 1.02,
    hat: 'bucket', hatColor: '#5a6b7a', accent: '#e0e6ea', nose: 'carrot',
  },
  ice_friend_rare: {
    fur: '#dceaf4', light: '#ffffff', ears: 'round', eye: '#3f8fd0', aspect: 0.97,
    markings: 'spots', accent: '#8fc4e8', nose: 'button',
  },
};

const FALLBACK: FriendFace = {
  fur: '#c9b8a8', light: '#efe6dc', ears: 'round', eye: '#4a4a4a', aspect: 0.95, nose: 'button',
};

export function FriendPortrait({
  id,
  locked = false,
  size = 76,
}: {
  id: string;
  locked?: boolean;
  size?: number;
}) {
  const f = FACES[id] ?? FALLBACK;
  const rx = 30 * f.aspect;
  const ry = 30;

  // Закрытый друг — то же лицо, сведённое к одному тону. Смысл именно в сохранении
  // формы: «есть какой-то колючий, с которым я ещё не знаком» — это повод пойти
  // играть, а замочек — нет.
  const fur = locked ? 'var(--friend-silhouette, #b9c0cc)' : f.fur;
  const light = locked ? 'var(--friend-silhouette, #b9c0cc)' : f.light;
  const accent = locked ? 'var(--friend-silhouette, #b9c0cc)' : (f.accent ?? f.fur);
  const hatColor = locked ? 'var(--friend-silhouette, #b9c0cc)' : (f.hatColor ?? '#888');

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      className={locked ? 'friend-portrait is-locked' : 'friend-portrait'}
    >
      {f.markings === 'spikes' && (
        <g fill={accent}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (0.08 + (i / 8) * 0.84);
            const cx = 50 - Math.cos(a) * rx * 0.98;
            const cy = 50 - Math.sin(a) * ry * 0.98;
            return (
              <circle key={i} cx={cx} cy={cy} r={7} />
            );
          })}
        </g>
      )}

      {f.ears === 'round' && (
        <>
          <ellipse cx={50 - rx * 0.66} cy={50 - ry * 0.72} rx={10} ry={11} fill={fur} />
          <ellipse cx={50 + rx * 0.66} cy={50 - ry * 0.72} rx={10} ry={11} fill={fur} />
          <ellipse cx={50 - rx * 0.66} cy={50 - ry * 0.7} rx={5} ry={5.6} fill={accent} />
          <ellipse cx={50 + rx * 0.66} cy={50 - ry * 0.7} rx={5} ry={5.6} fill={accent} />
        </>
      )}
      {(f.ears === 'pointed' || f.ears === 'tufted') && (
        <>
          <path d={`M${50 - rx * 0.8} ${50 - ry * 0.3} L${50 - rx * 0.62} ${50 - ry * 1.32} L${50 - rx * 0.2} ${50 - ry * 0.62} Z`} fill={fur} />
          <path d={`M${50 + rx * 0.8} ${50 - ry * 0.3} L${50 + rx * 0.62} ${50 - ry * 1.32} L${50 + rx * 0.2} ${50 - ry * 0.62} Z`} fill={fur} />
          {f.ears === 'tufted' && (
            <>
              <path d={`M${50 - rx * 0.62} ${50 - ry * 1.32} l3 -9 l4 9 Z`} fill={accent} />
              <path d={`M${50 + rx * 0.62} ${50 - ry * 1.32} l-3 -9 l-4 9 Z`} fill={accent} />
            </>
          )}
        </>
      )}

      <ellipse cx={50} cy={52} rx={rx} ry={ry} fill={fur} />

      {f.markings === 'spots' && !locked && (
        <g fill={accent} opacity={0.55}>
          <ellipse cx={50 - rx * 0.62} cy={44} rx={5.5} ry={4.4} />
          <ellipse cx={50 + rx * 0.58} cy={38} rx={4.6} ry={3.8} />
          <ellipse cx={50 + rx * 0.34} cy={62} rx={4} ry={3.2} />
        </g>
      )}
      {f.markings === 'stitches' && !locked && (
        <g stroke={accent} strokeWidth={2} strokeLinecap="round">
          <line x1={50 - rx * 0.5} y1={64} x2={50 + rx * 0.5} y2={64} />
          <line x1={50 - rx * 0.3} y1={60} x2={50 - rx * 0.3} y2={68} />
          <line x1={50} y1={60} x2={50} y2={68} />
          <line x1={50 + rx * 0.3} y1={60} x2={50 + rx * 0.3} y2={68} />
        </g>
      )}

      {/* Морда */}
      <ellipse cx={50} cy={62} rx={rx * 0.5} ry={ry * 0.34} fill={light} />

      {/* Глаза: белки только у уже известного друга. */}
      <ellipse cx={50 - rx * 0.34} cy={47} rx={7} ry={7.6} fill={locked ? fur : '#ffffff'} />
      <ellipse cx={50 + rx * 0.34} cy={47} rx={7} ry={7.6} fill={locked ? fur : '#ffffff'} />
      <circle cx={50 - rx * 0.34} cy={48} r={4} fill={locked ? 'var(--friend-silhouette-eye, #97a1b0)' : f.eye} />
      <circle cx={50 + rx * 0.34} cy={48} r={4} fill={locked ? 'var(--friend-silhouette-eye, #97a1b0)' : f.eye} />
      {!locked && (
        <>
          <circle cx={50 - rx * 0.34} cy={48} r={1.9} fill="#16202c" />
          <circle cx={50 + rx * 0.34} cy={48} r={1.9} fill="#16202c" />
          <circle cx={50 - rx * 0.34 + 2} cy={45.6} r={1.3} fill="#ffffff" />
          <circle cx={50 + rx * 0.34 + 2} cy={45.6} r={1.3} fill="#ffffff" />
        </>
      )}

      {f.nose === 'button' && <ellipse cx={50} cy={58} rx={3.6} ry={2.8} fill={locked ? fur : (f.accent ?? '#c98')} />}
      {f.nose === 'carrot' && (
        <path d={`M46 58 L${50 + rx * 0.9} 62 L46 63 Z`} fill={locked ? fur : '#e8892b'} />
      )}

      {f.beard && !locked && (
        <path d={`M${50 - rx * 0.52} 66 Q50 ${86} ${50 + rx * 0.52} 66 Q50 78 ${50 - rx * 0.52} 66 Z`} fill={f.accent} />
      )}

      {f.hat === 'cap' && (
        <>
          <path d={`M${50 - rx * 1.02} 34 A ${rx} ${ry} 0 0 1 ${50 + rx * 1.02} 34 Z`} fill={hatColor} />
          <rect x={50 - rx * 0.2} y={31} width={rx * 1.3} height={6} rx={3} fill={hatColor} />
        </>
      )}
      {f.hat === 'leaf' && (
        <path d={`M${50 - rx * 1.05} 33 Q50 ${-2} ${50 + rx * 1.05} 33 Q50 22 ${50 - rx * 1.05} 33 Z`} fill={hatColor} />
      )}
      {f.hat === 'bucket' && (
        <>
          <rect x={50 - rx * 0.98} y={26} width={rx * 1.96} height={6} rx={3} fill={hatColor} />
          <rect x={50 - rx * 0.7} y={8} width={rx * 1.4} height={20} rx={3} fill={hatColor} />
        </>
      )}
      {f.hat === 'hood' && (
        // Полоса вокруг макушки с острым верхом, нарисованная одним замкнутым
        // контуром. В первой версии это были две дуги почти одинакового радиуса,
        // схлопывавшиеся в полумесяц, который читался как волосы, падающие на лицо.
        <path
          d={
            `M${50 - rx * 1.12} 54 ` +
            `A ${rx * 1.12} ${ry * 1.12} 0 0 1 ${50 + rx * 1.12} 54 ` +
            `L${50 + rx * 0.86} 50 ` +
            `A ${rx * 0.86} ${ry * 0.86} 0 0 0 ${50 - rx * 0.86} 50 Z`
          }
          fill={hatColor}
        />
      )}

      {locked && (
        <text
          x="50"
          y="60"
          textAnchor="middle"
          fontSize="30"
          fontWeight="700"
          fill="var(--friend-silhouette-mark, #ffffff)"
          opacity="0.85"
        >
          ?
        </text>
      )}
    </svg>
  );
}
