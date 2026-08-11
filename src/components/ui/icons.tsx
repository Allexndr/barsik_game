/**
 * BARSIK icon set — inline SVG, brand-consistent, no emoji.
 * Single source for every pictogram used across HUD / Hub / Settings.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, ...rest };
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        fill="currentColor"
        d="M12 2.6l2.77 5.94 6.4.63-4.83 4.44 1.36 6.36L12 16.98l-5.7 3-1.36-6.36-4.83-4.44 6.4-.63L12 2.6z"
      />
    </svg>
  );
}

export function IconFruit(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        fill="currentColor"
        d="M12.4 3.6c.35-.65 1-1.1 1.7-1.2-.05.9-.55 1.75-1.3 2.2.55.05 1.05.25 1.4.55C16.8 6.3 18 8.6 18 11.1c0 4.15-2.9 8.9-6 8.9s-6-4.75-6-8.9c0-2.7 1.4-5.05 3.4-6.15.85-.47 1.85-.47 2.6.02.28.18.56.4.8.63.1-.72.35-1.4.6-2.03z"
      />
    </svg>
  );
}

export function IconPaw(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="15.5" rx="5.4" ry="4.6" fill="currentColor" />
      <ellipse cx="5.4" cy="9.6" rx="2.1" ry="2.6" fill="currentColor" />
      <ellipse cx="9.6" cy="6.4" rx="2.1" ry="2.7" fill="currentColor" />
      <ellipse cx="14.4" cy="6.4" rx="2.1" ry="2.7" fill="currentColor" />
      <ellipse cx="18.6" cy="9.6" rx="2.1" ry="2.6" fill="currentColor" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="10" rx="3" fill="currentColor" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M4.5 12.5l5 5 10-11"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.72 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.84 14.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.49.39 1.03.7 1.62.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
      />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M5 5l14 14M19 5L5 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSoundOn(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path fill="currentColor" d="M4 9v6h4l5 5V4L8 9H4z" />
      <path
        d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSoundOff(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path fill="currentColor" d="M4 9v6h4l5 5V4L8 9H4z" />
      <path
        d="M16 9l5 6m0-6l-5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMessage(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M4.5 5.5h15v10.2a3 3 0 0 1-3 3H10l-4.7 2.8.8-2.8H7.5a3 3 0 0 1-3-3V5.5z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M4.5 5.5h15v10.2a3 3 0 0 1-3 3H10l-4.7 2.8.8-2.8H7.5a3 3 0 0 1-3-3V5.5zM8 10h8m-8 3.4h5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconMusicNote(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M15.8 3.5v11.2a3.35 3.35 0 1 1-1.8-3V7.1l-6.2 1.55v7.15a3.35 3.35 0 1 1-1.8-3.02V7.25l9.8-2.45z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconLantern(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 7.3V6a4 4 0 0 1 8 0v1.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 8h10l1.5 10.5H5.5L7 8z" fill="currentColor" opacity="0.18" />
      <path d="M7 8h10l1.5 10.5H5.5L7 8z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M12 11c1.25 1.2 1.75 2.05 1.75 2.9A1.75 1.75 0 0 1 12 15.65a1.75 1.75 0 0 1-1.75-1.75c0-.85.5-1.7 1.75-2.9z" fill="currentColor" />
    </svg>
  );
}

export function IconStitch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 7.5c3.1 0 3.1 9 6.2 9s3.1-9 6.2-9" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M5 4.5v3M8.1 12.5v3M14.3 12.5v3M18 4.5v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconRotatePhone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8.2" y="4" width="7.6" height="13.4" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="14.8" r="0.7" fill="currentColor" />
      <path
        d="M5.3 8.5a7.3 7.3 0 0 1 12.3-2.2M18.7 15.5a7.3 7.3 0 0 1-12.3 2.2M15.6 4.6l2.4 1.7-2 2.1M8.4 19.4L6 17.7l2-2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M15 5l-7 7 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMinus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconCompass(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path fill="currentColor" d="M15.5 8.5l-2.2 5-5 2.2 2.2-5 5-2.2z" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        fill="currentColor"
        d="M12 2.5l7.5 3v6c0 5-3.2 8.6-7.5 10-4.3-1.4-7.5-5-7.5-10v-6l7.5-3z"
      />
      <path
        d="M9 12l2.2 2.2L15.5 9.7"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        fill="currentColor"
        d="M9 3L4 5v16l5-2 6 2 5-2V3l-5 2-6-2z"
        opacity="0.15"
      />
      <path
        d="M9 3v16m6-16v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 3L4 5v16l5-2 6 2 5-2V3l-5 2-6-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" fill="currentColor" opacity="0.15" />
      <path
        d="M3.5 6l7.4 6a1.7 1.7 0 0 0 2.2 0l7.4-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        fill="currentColor"
        d="M6.6 2.5c.9-.3 1.8.1 2.1 1l1 2.6c.3.7.1 1.5-.4 2l-1.3 1.3c.9 2.1 2.5 3.7 4.6 4.6l1.3-1.3c.5-.5 1.3-.7 2-.4l2.6 1c.9.3 1.3 1.2 1 2.1l-.7 2c-.3.9-1.2 1.4-2.1 1.3C10.4 17.9 5.1 12.6 4.3 5.3c-.1-.9.4-1.8 1.3-2.1z"
      />
    </svg>
  );
}

export function IconGift(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="10" width="16" height="10" rx="1.5" fill="currentColor" />
      <rect x="3" y="7" width="18" height="4" rx="1.2" fill="currentColor" opacity="0.8" />
      <rect x="11" y="7" width="2" height="13" fill="#fff" opacity="0.6" />
      <path
        d="M9 7c-1.8 0-3-1-3-2.5S7.2 2 9 2c1.7 0 3 2 3 5-2 0-3 0-3 0z"
        fill="currentColor"
      />
      <path
        d="M15 7c1.8 0 3-1 3-2.5S16.8 2 15 2c-1.7 0-3 2-3 5 2 0 3 0 3 0z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconFriends(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8.5" cy="8.5" r="3" fill="currentColor" />
      <circle cx="16" cy="9.5" r="2.4" fill="currentColor" opacity="0.7" />
      <path
        d="M3 20c0-3 2.5-5.2 5.5-5.2S14 17 14 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14.5 20c0-2.3 1.7-4.2 4-4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
