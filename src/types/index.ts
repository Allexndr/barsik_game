export interface Player {
  id: string;
  nick: string;
  gender: 'boy' | 'girl';
  ageCategory: 'a' | 'b' | 'c' | '';
  phone: string;
  email: string;
  lang: 'ru' | 'kk';
  level: number;
  stars: number;
  createdAt: string;
  /** Progressive profile */
  profileStage: 'guest_nick' | 'phone' | 'email' | 'complete';
  phoneAskedAt?: string;
  emailAskedAt?: string;
  playStartedAt?: string;
}

export interface Friend {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'legend';
  chapter: number;
  location?: string;
  unlocked: boolean;
  asset: string;
}

export interface LevelConfig {
  id: number;
  chapter: number;
  title: string;
  description: string;
  scene: string;
  duration: number;
  interactivity: 'explore' | 'find' | 'help' | 'choice' | 'timing' | 'decor';
  reward: {
    stars: number;
    friend?: string;
    decoration?: string;
  };
  narrative: {
    ru: string;
    kk: string;
  };
}

export type SoftGateKind = 'phone_1min' | 'phone_5levels' | 'email' | null;
