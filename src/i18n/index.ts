import { logWarn } from '@/utils/logger';

export type Lang = 'ru' | 'kk';

export const LANG_KEY = 'barsik_lang';

export function isLang(v: unknown): v is Lang {
  return v === 'ru' || v === 'kk';
}

export function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (isLang(v)) return v;
  } catch (e) {
    logWarn('readStoredLang', e);
  }
  return 'ru';
}

export function writeStoredLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {
    logWarn('writeStoredLang', e);
  }
}

type Dict = Record<string, string>;

const ru: Dict = {
  'welcome.play': 'Играть',
  'welcome.start': 'Старт игры',
  'welcome.settings': 'Настройки',
  'welcome.profile': 'Профиль',
  'welcome.lang.ru': 'RU',
  'welcome.lang.kk': 'ҚАЗ',
  'welcome.alt': 'Barsik — старт игры',

  'quick.back': '← Назад',
  'quick.title': 'Как тебя зовут?',
  'quick.sub': 'Только имя — и сразу в приключение. Остальное спросим позже.',
  'quick.nick': 'Твой ник',
  'quick.placeholder': 'Например: Айя',
  'quick.gender': 'Кто твой Барсик?',
  'quick.boy': 'Мальчик',
  'quick.girl': 'Девочка',
  'quick.go': 'Играть!',
  'nick.short': 'Имя слишком короткое',
  'nick.long': 'Максимум 16 символов',
  'nick.chars': 'Только буквы, цифры и _',
  'nick.taken': 'Такое имя уже есть',
  'nick.take': 'взять',

  'nav.travel': 'Путешествие',
  'nav.friends': 'Друзья',
  'nav.city': 'Город',
  'nav.shop': 'Магазин',
  'nav.leaderboard': 'Рейтинг',
  'nav.qr': 'Сундук',

  'gate.phone1.title': 'Минутка! Сохраним, чтобы не потерять',
  'gate.phone5.title': 'Уже 5 уровней! Сохраним прогресс?',
  'gate.email.title': 'Почта родителя — на потом',
  'gate.phone.body':
    'Телефон — чтобы вернуть игру на другом телефоне и записать прогресс. Можно пропустить и продолжить играть.',
  'gate.email.body':
    'Почта нужна только для важных новостей о сезоне и призах. Можно пропустить.',
  'gate.save': 'Сохранить',
  'gate.later': 'Позже',
  'gate.phone.err': 'Введи номер полностью (или нажми «Позже»)',
  'gate.email.err': 'Похоже, почта с опечаткой',

  'settings.title': 'Настройки',
  'settings.close': 'Закрыть',
  'settings.lang': 'Язык',
  'settings.exit': 'Выйти на старт',
  'settings.exit.hint': 'Можно снова нажать «Играть» и войти под ником.',
  'settings.sound': 'Звук',
  'settings.soon': 'скоро',
  'settings.mute.on': 'Выключен',
  'settings.mute.off': 'Включён',
  'settings.parent': 'Для родителей',
  'settings.parent.body':
    'Без рекламы и покупок за пределами игры. Прогресс хранится на этом устройстве. Игра создана для детей 3–15 лет.',

  'reward.title': 'Подарки',
  'reward.sub': 'Собирай звёзды — получай призы',
  'reward.at': 'за {n} звёзд',
  'reward.stickers': 'Наклейки',
  'reward.mug': 'Кружка',
  'reward.shirt': 'Футболка',
  'reward.backpack': 'Рюкзак',
  'reward.grand': 'Главный приз',

  'doc.title': 'Путешествие Барсика',
};

const kk: Dict = {
  'welcome.play': 'Ойнау',
  'welcome.start': 'Ойын бастау',
  'welcome.settings': 'Баптаулар',
  'welcome.profile': 'Профиль',
  'welcome.lang.ru': 'RU',
  'welcome.lang.kk': 'ҚАЗ',
  'welcome.alt': 'Barsik — ойын бастау',

  'quick.back': '← Артқа',
  'quick.title': 'Атың кім?',
  'quick.sub': 'Тек есім — және бірден саяхатқа. Қалғанын кейін сұраймыз.',
  'quick.nick': 'Сенің нигің',
  'quick.placeholder': 'Мысалы: Айя',
  'quick.gender': 'Сенің Барсигің кім?',
  'quick.boy': 'Ұл',
  'quick.girl': 'Қыз',
  'quick.go': 'Ойнау!',
  'nick.short': 'Есім тым қысқа',
  'nick.long': 'Ең көбі 16 таңба',
  'nick.chars': 'Тек әріп, сан және _',
  'nick.taken': 'Мұндай есім бар',
  'nick.take': 'алу',

  'nav.travel': 'Саяхат',
  'nav.friends': 'Достар',
  'nav.city': 'Қала',
  'nav.shop': 'Дүкен',
  'nav.leaderboard': 'Рейтинг',
  'nav.qr': 'Сандық',

  'gate.phone1.title': 'Бір минут! Жоғалтпау үшін сақтайық',
  'gate.phone5.title': '5 деңгей өтті! Прогресті сақтаймыз ба?',
  'gate.email.title': 'Ата-ана почтасы — кейін',
  'gate.phone.body':
    'Телефон — басқа құрылғыда ойынды қайтару және прогресті жазу үшін. Өткізіп, ойнауды жалғастыруға болады.',
  'gate.email.body':
    'Почта тек маусым мен жүлделер туралы маңызды жаңалықтар үшін. Өткізуге болады.',
  'gate.save': 'Сақтау',
  'gate.later': 'Кейін',
  'gate.phone.err': 'Нөмірді толық енгіз (немесе «Кейін» бас)',
  'gate.email.err': 'Почтада қате бар сияқты',

  'settings.title': 'Баптаулар',
  'settings.close': 'Жабу',
  'settings.lang': 'Тіл',
  'settings.exit': 'Бастауға шығу',
  'settings.exit.hint': 'Қайта «Ойнау» басып, никпен кіруге болады.',
  'settings.sound': 'Дыбыс',
  'settings.soon': 'жақында',
  'settings.mute.on': 'Өшірулі',
  'settings.mute.off': 'Қосулы',
  'settings.parent': 'Ата-аналарға',
  'settings.parent.body':
    'Жарнамасыз және ойыннан тыс сатып алусыз. Прогресс осы құрылғыда сақталады. Ойын 3–15 жас балаларға арналған.',

  'reward.title': 'Сыйлықтар',
  'reward.sub': 'Жұлдыз жина — сыйлық ал',
  'reward.at': '{n} жұлдыз үшін',
  'reward.stickers': 'Жапсырмалар',
  'reward.mug': 'Кружка',
  'reward.shirt': 'Футболка',
  'reward.backpack': 'Рюкзак',
  'reward.grand': 'Бас жүлде',

  'doc.title': 'Барсик саяхаты',
};

const dictionaries: Record<Lang, Dict> = { ru, kk };

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const raw = dictionaries[lang][key] ?? dictionaries.ru[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce((s, [k, v]) => {
    const val = String(v);
    return s.split(`{${k}}`).join(val).split(`#{${k}}`).join(val);
  }, raw);
}

/**
 * Language-aware asset path.
 * Convention:
 * - RU default: `/assets/foo/bar.png`
 * - KK:         `/assets/foo/bar_kk.png`
 * Falls back to RU path if KK file missing (caller may onError swap).
 */
export function localizedAsset(path: string, lang: Lang): string {
  if (lang === 'ru') return path;
  const q = path.indexOf('?');
  const base = q >= 0 ? path.slice(0, q) : path;
  const query = q >= 0 ? path.slice(q) : '';
  const dot = base.lastIndexOf('.');
  if (dot < 0) return `${base}_kk${query}`;
  return `${base.slice(0, dot)}_kk${base.slice(dot)}${query}`;
}
