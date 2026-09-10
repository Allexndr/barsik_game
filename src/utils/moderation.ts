/**
 * Проверка текста, который ребёнок вводит и который увидит другой человек.
 *
 * Сегодня это ник: свободный текст вообще без проверок — `normalizeNick` только
 * обрезает пробелы и приводит к нижнему регистру, — и он публично показывается в
 * таблице результатов. В продукте для детей пяти-двенадцати лет это уже канал к
 * другим пользователям, и он немодерируем.
 *
 * Завтра это чат в городе. Правила живут здесь, в одном модуле без зависимостей
 * от браузера, именно чтобы серверный фильтр мог импортировать тот же файл.
 * **Вызов на клиенте — вежливость, а не контроль**: Supabase Realtime вещает от
 * клиента к клиенту, и фильтр, работающий только в браузере, обходит любой, кто
 * откроет консоль. Чат обязан вызывать это из edge-функции до рассылки сообщения.
 *
 * Проверяются две вещи, и вторая для детской безопасности важнее первой:
 * бранные слова и всё, что похоже на попытку увести разговор за пределы
 * площадки, — номер телефона, ник в другом сервисе, ссылка. Груминг начинается с
 * «добавь меня там-то».
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
 * Сворачивает приёмы, которыми слово протаскивают мимо поиска по подстроке:
 * похожие буквы латиницы и кириллицы, цифры вместо букв, разделители и
 * растянутые повторы.
 *
 * Всё приводится к кириллице: на ней написаны запрещённые корни, и её же
 * используют оба языка сайта.
 */
const FOLD: Record<string, string> = {
  // Латинские буквы, похожие на кириллические.
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р',
  t: 'т', x: 'х', y: 'у', u: 'и', i: 'и', j: 'й', g: 'г', d: 'д', z: 'з',
  n: 'н', s: 'с', f: 'ф', r: 'р', l: 'л', v: 'в', w: 'ш', q: 'к',
  // Digits and symbols used as letters. 9 is «я» — the mirrored shape is the
  // standard substitution in Russian leetspeak, and reading it as «г» let
  // «бл9ть» through.
  '0': 'о', '1': 'и', '3': 'е', '4': 'ч', '5': 'с', '6': 'б', '7': 'т',
  '9': 'я', '@': 'а', '$': 'с', '!': 'и', '*': '', '.': '', ',': '',
  // Кириллические варианты, которые не должны порождать второе написание.
  ё: 'е', й: 'и', ъ: '', ь: '',
  // Казахские буквы сворачиваются к ближайшей русской основе, чтобы запрещённый
  // корень, написанный ими, всё равно ловился.
  ә: 'а', ғ: 'г', қ: 'к', ң: 'н', ө: 'о', ұ: 'у', ү: 'у', һ: 'х', і: 'и',
};

/** Каноническая форма только для сопоставления — никому не показывается. */
export function normalizeForMatch(input: string): string {
  const lowered = input.toLowerCase().normalize('NFKC');
  let out = '';
  for (const ch of lowered) {
    const folded = FOLD[ch];
    if (folded !== undefined) out += folded;
    else if (/[а-яa-z0-9]/.test(ch)) out += ch;
    // Всё прочее — пробелы, дефисы, точки, эмодзи — выбрасывается, поэтому
    // «х-у-й» и «х у й» сворачиваются в ту же строку, что и слово без разделителей.
  }
  // Stretched letters: "ссссука" -> "сука".
  return out.replace(/(.)\1{1,}/g, '$1');
}

/**
 * Запрещённые корни, уже в свёрнутой форме.
 *
 * Именно корни, а не слова целиком: русский язык склоняется, и задача — поймать
 * основу везде, где она встретится. Список намеренно короткий: он проверяется как
 * подстрока, поэтому неаккуратная запись блокирует невинные слова, а ребёнок,
 * который не может ввести собственное имя из-за фильтра, — исход хуже, чем грубый
 * ник. Всё спорное место не здесь, а в очереди на ручной разбор.
 */
const BLOCKED_ROOTS: readonly string[] = [
  // Русские нецензурные основы.
  'хуи', 'хуе', 'хуя', 'пизд', 'ебат', 'ебан', 'ебал', 'ебуч', 'ебло',
  'бляд', 'блят', 'муда', 'гандо', 'пидор', 'пидар', 'долбое', 'залуп',
  'дроч', 'манда', 'сука', 'сучка', 'шлюх', 'шалав', 'выеб', 'заеб',
  'наеб', 'уеба', 'отъеб', 'отьеб', 'ебыр', 'жопа', 'срака', 'говн',
  // Оскорбления и язык вражды, русский.
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

/** Каноническая форма для латиницы: цифры и разделители свёрнуты, повторы схлопнуты. */
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
  /\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d/, // шесть и более цифр
  /@[a-zа-я0-9_]{3,}/i,
  /https?:\/\//i,
  /(?:www\.|t\.me|vk\.com|wa\.me)/i,
  /\.(?:ru|com|kz|net|org|me|io)(?![\p{L}])/iu,
  /(?<![\p{L}])(?:телеграм|телега|тг|вотсап|ватсап|вацап|whatsapp|telegram|инста|instagram|тикток|tiktok|discord|дискорд|вайбер|viber)(?![\p{L}])/iu,
];

export interface ModerationOptions {
  minLength?: number;
  maxLength?: number;
  /** В чате допустимы пробелы и знаки препинания, в нике — нет. */
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
  // Намеренно мягко и без конкретики. Ребёнок, написавший грубость на спор,
  // должен получить пожатие плечами, а не нотацию; ребёнку, случайно задевшему
  // фильтр, нельзя сообщать, будто он сказал что-то плохое.
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
