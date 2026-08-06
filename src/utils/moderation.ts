/**
 * Text safety for anything a child types that another person will see.
 *
 * Today that is the nickname: it is free text with no check at all —
 * `normalizeNick` only trims and lowercases — and it is displayed publicly on
 * the leaderboard. In a product for five- to twelve-year-olds that is already
 * a channel to other users, and it is unmoderated.
 *
 * Tomorrow it is the city chat. The rules live here, in one module with no
 * browser dependencies, precisely so the server-side filter can import the
 * same file. **The client-side call is a courtesy, not a control**: Supabase
 * Realtime broadcasts client to client, so a filter that runs only in the
 * browser is bypassed by anyone who opens the console. Chat must call this
 * from an edge function before the message is broadcast.
 *
 * Two things are checked, and the second matters more than the first for
 * child safety: abusive words, and anything that looks like a way to move the
 * conversation off-platform (a phone number, a handle, a link). Grooming
 * starts with "add me on".
 */

export type ModerationReason =
  | 'too-short'
  | 'too-long'
  | 'charset'
  | 'profanity'
  | 'contact';

export type ModerationVerdict =
  | { ok: true; text: string }
  | { ok: false; reason: ModerationReason };

/**
 * Fold the tricks people use to slip a word past a substring match:
 * homoglyphs between Latin and Cyrillic, digits standing in for letters,
 * padding characters, and stretched repeats.
 *
 * Everything ends up in Cyrillic, because that is the alphabet the blocked
 * roots are written in and the one both site languages use.
 */
const FOLD: Record<string, string> = {
  // Latin letters that look like Cyrillic ones.
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р',
  t: 'т', x: 'х', y: 'у', u: 'и', i: 'и', j: 'й', g: 'г', d: 'д', z: 'з',
  n: 'н', s: 'с', f: 'ф', r: 'р', l: 'л', v: 'в', w: 'ш', q: 'к',
  // Digits and symbols used as letters. 9 is «я» — the mirrored shape is the
  // standard substitution in Russian leetspeak, and reading it as «г» let
  // «бл9ть» through.
  '0': 'о', '1': 'и', '3': 'е', '4': 'ч', '5': 'с', '6': 'б', '7': 'т',
  '9': 'я', '@': 'а', '$': 'с', '!': 'и', '*': '', '.': '', ',': '',
  // Cyrillic variants that should not create a second spelling.
  ё: 'е', й: 'и', ъ: '', ь: '',
  // Kazakh letters folded to their nearest Russian base, so a blocked root
  // written with them is still caught.
  ә: 'а', ғ: 'г', қ: 'к', ң: 'н', ө: 'о', ұ: 'у', ү: 'у', һ: 'х', і: 'и',
};

/** Canonical form used for matching only — never shown to anyone. */
export function normalizeForMatch(input: string): string {
  const lowered = input.toLowerCase().normalize('NFKC');
  let out = '';
  for (const ch of lowered) {
    const folded = FOLD[ch];
    if (folded !== undefined) out += folded;
    else if (/[а-яa-z0-9]/.test(ch)) out += ch;
    // Everything else — spaces, dashes, dots, emoji — is dropped, so
    // "х-у-й" and "х у й" collapse to the same string as the plain word.
  }
  // Stretched letters: "ссссука" -> "сука".
  return out.replace(/(.)\1{1,}/g, '$1');
}

/**
 * Blocked roots, already in folded form.
 *
 * Roots rather than whole words, because Russian inflects and the point is to
 * catch the stem wherever it appears. Kept deliberately short: this list is
 * checked as a substring, so a loose entry blocks innocent words, and a child
 * who cannot enter their own name because of a filter is a worse outcome than
 * a rude nickname. Anything ambiguous belongs in a review queue, not here.
 */
const BLOCKED_ROOTS: readonly string[] = [
  // ru — obscene stems
  'хуи', 'хуе', 'хуя', 'пизд', 'ебат', 'ебан', 'ебал', 'ебуч', 'ебло',
  'бляд', 'блят', 'муда', 'гандо', 'пидор', 'пидар', 'долбое', 'залуп',
  'дроч', 'манда', 'сука', 'сучка', 'шлюх', 'шалав', 'выеб', 'заеб',
  'наеб', 'уеба', 'отъеб', 'отьеб', 'ебыр', 'жопа', 'срака', 'говн',
  // slurs and hate terms, ru
  'жид', 'хохол', 'чурк', 'даун', 'дебил', 'урод',
];

/**
 * Latin roots, checked against a Latin-normalised copy.
 *
 * They cannot live in the Cyrillic list: folding is one-way and lossy, so
 * "fuck" lands on «фиск» while a hand-written «фуцк» expects u→у and c→ц. One
 * mapping cannot satisfy both, and guessing produced a list that matched
 * nothing. Two passes, each over the alphabet it was written for.
 */
const BLOCKED_LATIN: readonly string[] = [
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'asshol', 'nigg', 'dick', 'whore',
  'cyka', 'suka', 'blyat', 'blyad', 'pizd', 'xyi', 'huy', 'pidor', 'mudak',
];

/** Latin-side canonical form: digits and padding folded, repeats collapsed. */
function normalizeLatin(input: string): string {
  const lowered = input.toLowerCase().normalize('NFKC');
  let out = '';
  for (const ch of lowered) {
    if (/[a-z]/.test(ch)) out += ch;
    else if (ch === '0') out += 'o';
    else if (ch === '1' || ch === '!') out += 'i';
    else if (ch === '3') out += 'e';
    else if (ch === '4') out += 'a';
    else if (ch === '5' || ch === '$') out += 's';
    else if (ch === '7') out += 't';
    else if (ch === '@') out += 'a';
  }
  return out.replace(/(.)\1{1,}/g, '$1');
}

/**
 * Words that contain a blocked root but are not the blocked word.
 *
 * «Сукачёв» is a surname, «мудрость» is not «муда», and a filter that costs a
 * child their own name is a bug in the filter.
 */
const ALLOW_LIST: readonly string[] = [
  'сукачев', 'сукал', 'сукно', 'сукин', // сук- family
  'мудрост', 'мудры', 'мудрец',
  'дискав', 'диско', 'дисциплин',
  'жидкост', 'жидки',
  'ебург', 'екатеринбург',
];

/**
 * Looks like a way to continue the conversation somewhere unmoderated.
 *
 * Note the lookarounds instead of \b on the Cyrillic alternation: in
 * JavaScript \b is defined against [A-Za-z0-9_], so `\bтг\b` never matches
 * inside Russian text — «напиши в тг» passed the filter untouched.
 */
const CONTACT_PATTERNS: readonly RegExp[] = [
  /\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d/, // 6+ digits
  /@[a-zа-я0-9_]{3,}/i,
  /https?:\/\//i,
  /(?:www\.|t\.me|vk\.com|wa\.me)/i,
  /\.(?:ru|com|kz|net|org|me|io)(?![\p{L}])/iu,
  /(?<![\p{L}])(?:телеграм|телега|тг|вотсап|ватсап|вацап|whatsapp|telegram|инста|instagram|тикток|tiktok|discord|дискорд|вайбер|viber)(?![\p{L}])/iu,
];

export interface ModerationOptions {
  minLength?: number;
  maxLength?: number;
  /** Chat allows spaces and punctuation; a nickname does not. */
  allowPunctuation?: boolean;
}

export function checkText(raw: string, opts: ModerationOptions = {}): ModerationVerdict {
  const { minLength = 2, maxLength = 16, allowPunctuation = false } = opts;
  const text = raw.trim().replace(/\s+/g, ' ');

  if (text.length < minLength) return { ok: false, reason: 'too-short' };
  if (text.length > maxLength) return { ok: false, reason: 'too-long' };

  const allowed = allowPunctuation
    ? /^[\p{L}\p{N} .,!?—–-]+$/u
    : /^[\p{L}\p{N} _-]+$/u;
  if (!allowed.test(text)) return { ok: false, reason: 'charset' };

  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(text)) return { ok: false, reason: 'contact' };
  }

  const folded = normalizeForMatch(text);
  const spared = ALLOW_LIST.some((word) => folded.includes(normalizeForMatch(word)));
  if (!spared) {
    for (const root of BLOCKED_ROOTS) {
      if (folded.includes(root)) return { ok: false, reason: 'profanity' };
    }
  }

  const latin = normalizeLatin(text);
  for (const root of BLOCKED_LATIN) {
    if (latin.includes(root)) return { ok: false, reason: 'profanity' };
  }

  return { ok: true, text };
}

const MESSAGES: Record<ModerationReason, { ru: string; kk: string }> = {
  'too-short': { ru: 'Слишком коротко', kk: 'Тым қысқа' },
  'too-long': { ru: 'Слишком длинно', kk: 'Тым ұзын' },
  charset: {
    ru: 'Только буквы, цифры и дефис',
    kk: 'Тек әріптер, сандар және сызықша',
  },
  // Deliberately gentle and non-specific. A child who typed something rude on
  // a dare should get a shrug, not a lecture; a child who tripped the filter
  // by accident should not be told they said something bad.
  profanity: {
    ru: 'Давай выберем другое слово',
    kk: 'Басқа сөз таңдайық',
  },
  contact: {
    ru: 'Не пиши здесь телефон и ссылки — это небезопасно',
    kk: 'Мұнда телефон мен сілтеме жазба — бұл қауіпсіз емес',
  },
};

export function moderationMessage(reason: ModerationReason, lang: 'ru' | 'kk'): string {
  return MESSAGES[reason][lang];
}
