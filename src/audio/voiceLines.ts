/**
 * Идентичность произносимой реплики, общая для скрипта сборки и браузера.
 *
 * Сейчас игра говорит через `window.speechSynthesis`, а тот отдаёт задачу тому
 * голосу, который случайно оказался в системе. На казахской фразе это обычно
 * вообще ничто: Android не поставляет голос `kk-KZ`, — и половина аудитории
 * получает тишину или русский голос, коверкающий казахский. Ни то, ни другое
 * недопустимо в игре, чьим игрокам пять лет и которые не могут прочитать
 * пропущенную реплику.
 *
 * Набор реплик фиксирован и известен, поэтому их следует записать один раз,
 * проверить один раз и поставлять файлами. Этот модуль — договор между двумя
 * половинами: извлекатель даёт клипу имя, проигрыватель ищет по тому же имени.
 * Зависимостей у него нет ровно по той же причине, что и у фильтра модерации:
 * вторая копия правила именования, разошедшаяся с первой, — это ошибка, дающая
 * тишину, а тишину в тесте трудно заметить.
 */

/**
 * Everything that must be identical between "the text we rendered" and "the
 * text we are about to speak".
 *
 * Interpolations are dropped rather than rendered. `Собери печати, ${n}.`
 * cannot be one clip, because `n` is whatever the child typed at the start.
 * A recorded voice that skips the name is normal in children's games; the
 * alternative is falling back to the robot for every line that greets them,
 * which would be most of them.
 */
export function normalizeLine(input: string, nick?: string): string {
  let s = input;
  // При сборке подстановка ещё выглядит как `${n}` и исчезает по правилу ниже. Во
  // время работы там уже стоит имя ребёнка, и ничто в строке на это не указывает,
  // — поэтому вызывающий обязан сказать, какое имя. Без этого каждая реплика,
  // здоровающаяся с игроком, промахивалась мимо своего клипа и уходила в браузер;
  // поймано загрузкой самих байтов, а не доверием к коду 200, потому что
  // dev-сервер отвечает 200 с index.html на что угодно.
  if (nick && nick.trim().length > 1) {
    const esc = nick.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`(?<![\\p{L}])${esc}(?![\\p{L}])`, 'giu'), '');
  }
  return s
    // Подстановки — и в исходном виде, и то, что уже подставлено в место ника.
    .replace(/\$\{[^}]*\}/g, '')
    // Знаки препинания, осиротевшие после удаления: «, .» или « ,».
    .replace(/\s*,\s*([.!?])/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/,\s*$/g, '')
    // Эмодзи и пиктограммы стоят в заданиях, а не в диалогах, но случайно попавший
    // символ не должен менять идентичность клипа.
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * FNV-1a, 32 бита, в шестнадцатеричном виде. Маленький, без зависимостей,
 * одинаковый в Node и в браузере. Коллизии проверяются при извлечении, а не
 * объявляются невозможными: на нескольких сотнях реплик вероятность крошечная, но
 * коллизия здесь — это один персонаж, произносящий реплику другого.
 */
export function lineId(text: string, lang: 'ru' | 'kk', nick?: string): string {
  const key = `${lang}:${normalizeLine(text, nick).toLowerCase()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Пишется scripts/extract-voice-lines.mjs, читается AudioManager. */
export interface VoiceManifest {
  version: number;
  /** Расширение файлов, в которые записаны клипы, без точки. */
  format: string;
  /** Идентификатор и текст, из которого он записан, — чтобы разобраться с неверным клипом. */
  lines: Record<string, { lang: 'ru' | 'kk'; text: string }>;
}

export const VOICE_BASE = '/assets/voice/';
