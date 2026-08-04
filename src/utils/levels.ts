// Конфигурация уровней Сезона 1 (2 мира, 17 уровней 0..16).
// ИСТОЧНИК ПРАВДЫ: обёртки MissionNScreen + docs/GDD_CHAPTER1_FRUIT_FOREST.md.
// Раньше здесь были 40 рандомных заглушек и утёкший японский текст — удалено.
// Мир 1 «Фруктовый лес» = уровни 0–9, мир 2 «Ледяная долина» = уровни 10–16.

export type Interactivity = 'explore' | 'find' | 'help' | 'choice' | 'timing';

export interface LevelConfig {
  id: number;
  chapter: 1 | 2;
  title: string;
  description: string;
  duration: number; // целевой хронометраж первого прохождения, сек
  interactivity: Interactivity;
  reward: { stars: number; friend: string | null };
  narrative: { ru: string; kk: string };
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  // ── МИР 1: ФРУКТОВЫЙ ЛЕС (0–9) ──────────────────────────────
  {
    id: 0,
    chapter: 1,
    title: 'Первое утро',
    description: 'Проснись, научись ходить и помоги садовнику во Фруктовом лесу',
    duration: 300,
    interactivity: 'explore',
    reward: { stars: 10, friend: 'gardener' },
    narrative: {
      ru: 'Барсик просыпается в своём домике. Садовник просит помочь собрать фрукты и покормить птичку.',
      kk: 'Барсик өз үйінде оянады. Бағбан жеміс жинап, торғайды тамақтандыруға көмектесуді сұрайды.',
    },
  },
  {
    id: 1,
    chapter: 1,
    title: 'Первый друг',
    description: 'Пройди по тропе, освободи застрявший фрукт и познакомься с Айей',
    duration: 300,
    interactivity: 'help',
    reward: { stars: 15, friend: 'aya' },
    narrative: {
      ru: 'На лесной тропе застрял фрукт в липких нитях. Барсик освобождает его и знакомится со стеснительной Айей.',
      kk: 'Орман жолында жеміс жабысқақ жіптерге ілінген. Барсик оны босатып, ұялшақ Айямен танысады.',
    },
  },
  {
    id: 2,
    chapter: 1,
    title: 'Яблоневый сад',
    description: 'Помоги садовнику разложить яблоки по цветам корзин',
    duration: 300,
    interactivity: 'help',
    reward: { stars: 12, friend: null },
    narrative: {
      ru: 'В старом саду нужно рассортировать яблоки: красные, жёлтые и зелёные — в свои корзины.',
      kk: 'Ескі бақта алмаларды сұрыптау керек: қызыл, сары және жасыл — өз себеттеріне.',
    },
  },
  {
    id: 3,
    chapter: 1,
    title: 'Потерявшийся ёжик',
    description: 'Обыщи три сектора у старого дуба и найди ёжика',
    duration: 300,
    interactivity: 'find',
    reward: { stars: 20, friend: 'hedgehog' },
    narrative: {
      ru: 'У старого дуба потерялся маленький ёжик. Проверь кусты, камни и поваленное дерево.',
      kk: 'Ескі емен түбінде кішкентай кірпі жоғалып қалды. Бұталарды, тастарды және құлаған ағашты тексер.',
    },
  },
  {
    id: 4,
    chapter: 1,
    title: 'Качающийся мостик',
    description: 'Перейди подвесной мост, двигаясь в спокойные моменты',
    duration: 240,
    interactivity: 'timing',
    reward: { stars: 15, friend: null },
    narrative: {
      ru: 'Мост качается на ветру. Иди по секциям, когда они спокойны и светятся зелёным.',
      kk: 'Көпір желде тербеледі. Секциялар тынышталып, жасыл жанғанда жүр.',
    },
  },
  {
    id: 5,
    chapter: 1,
    title: 'Корзина для белочки',
    description: 'Проводи белочку до норки, не отставая по пути',
    duration: 260,
    interactivity: 'help',
    reward: { stars: 18, friend: 'squirrel' },
    narrative: {
      ru: 'Белочка устала нести тяжёлую корзину. Иди рядом до её норки — в награду жёлудь-ключ.',
      kk: 'Тиін ауыр себетті көтеруден шаршады. Оның ініне дейін қасында жүр — сыйға емен-кілт.',
    },
  },
  {
    id: 6,
    chapter: 1,
    title: 'Лесная загадка',
    description: 'Отгадай загадку пенька и выбери правильное дерево',
    duration: 240,
    interactivity: 'choice',
    reward: { stars: 16, friend: null },
    narrative: {
      ru: 'Пенёк-говорун загадывает загадки. Подойди к нужному дереву и нажми лапку.',
      kk: 'Сөйлейтін томар жұмбақ айтады. Керек ағашқа барып, табанды бас.',
    },
  },
  {
    id: 7,
    chapter: 1,
    title: 'Встреча с Путало',
    description: 'Подойди медленно и подружись с одиноким фотографом',
    duration: 300,
    interactivity: 'explore',
    reward: { stars: 25, friend: 'putalo' },
    narrative: {
      ru: 'Путало прячется за камнем. Иди шагом, не беги — и он покажет свою лучшую фотографию заката.',
      kk: 'Путало тас артына тығылады. Жүгірме, жай жүр — сонда ол ең әдемі суретін көрсетеді.',
    },
  },
  {
    id: 8,
    chapter: 1,
    title: 'Лесной праздник',
    description: 'Развесь гирлянды, поставь фонарики и накрой стол с друзьями',
    duration: 300,
    interactivity: 'help',
    reward: { stars: 20, friend: null },
    narrative: {
      ru: 'Друзья устраивают праздник. Развесь гирлянды, зажги фонарики и собери фрукты на стол.',
      kk: 'Достар мереке өткізеді. Гирляндаларды іл, шамдарды жақ және дастарханға жеміс жина.',
    },
  },
  {
    id: 9,
    chapter: 1,
    title: 'QR-сундук',
    description: 'Открой сундук жёлудём-ключом и заверши Фруктовый лес',
    duration: 200,
    interactivity: 'explore',
    reward: { stars: 30, friend: 'yagodka_rare' },
    narrative: {
      ru: 'В конце леса стоит сундук с замком-жёлудем. Открой его ключом — внутри карта к снежным горам.',
      kk: 'Орман шетінде емен-құлыпты сандық тұр. Кілтпен аш — ішінде қарлы тауларға апаратын карта.',
    },
  },

  // ── МИР 2: ЛЕДЯНАЯ ДОЛИНА (10–16) ───────────────────────────
  {
    id: 10,
    chapter: 2,
    title: 'Прощание с лесом',
    description: 'Обойди знакомые места и попрощайся с друзьями леса',
    duration: 260,
    interactivity: 'explore',
    reward: { stars: 15, friend: null },
    narrative: {
      ru: 'Пора в путь. Обойди дом, сад, мостик и поляну — попрощайся с каждым другом.',
      kk: 'Жолға шығатын кез. Үйді, бақты, көпірді және алаңды аралап, әр досыңмен қоштас.',
    },
  },
  {
    id: 11,
    chapter: 2,
    title: 'Первые снежинки',
    description: 'Лови падающие снежинки на снежном поле',
    duration: 240,
    interactivity: 'timing',
    reward: { stars: 18, friend: null },
    narrative: {
      ru: 'Идёт первый снег. Айя впервые видит снежинки — поймай их, пока они на земле.',
      kk: 'Алғашқы қар жауып тұр. Айя ұлпаларды алғаш көреді — жерде тұрғанда оларды ұста.',
    },
  },
  {
    id: 12,
    chapter: 2,
    title: 'Ледяная тропа',
    description: 'Аккуратно пройди скользкую тропу и собери кристаллы',
    duration: 300,
    interactivity: 'timing',
    reward: { stars: 20, friend: null },
    narrative: {
      ru: 'Тропа скользкая — Барсик скользит после остановки. Пройди все пять сегментов осторожно.',
      kk: 'Жол сырғанақ — Барсик тоқтағаннан кейін сырғанайды. Бес бөлікті де байқап өт.',
    },
  },
  {
    id: 13,
    chapter: 2,
    title: 'Ледяные скульптуры',
    description: 'Найди пять осколков льда для мастера скульптур',
    duration: 260,
    interactivity: 'help',
    reward: { stars: 16, friend: 'ice_master' },
    narrative: {
      ru: 'Мастеру льда не хватает осколков. Собери пять и принеси — он вырежет скульптуру Барсика!',
      kk: 'Мұз шеберіне сынықтар жетіспейді. Бесеуін жинап әкел — ол Барсиктің мүсінін жасайды!',
    },
  },
  {
    id: 14,
    chapter: 2,
    title: 'Поделись теплом',
    description: 'Найди тёплый шарф в сугробе и согрей Айю',
    duration: 260,
    interactivity: 'help',
    reward: { stars: 22, friend: null },
    narrative: {
      ru: 'Айе холодно. Найди шарф в сугробах и грейся у костра, если станет совсем зябко.',
      kk: 'Айя тоңып тұр. Қар үйіндісінен орамал тап, мұздап кетсең — от басында жылын.',
    },
  },
  {
    id: 15,
    chapter: 2,
    title: 'Спасти снеговика',
    description: 'Быстро принеси снег, пока снеговик не растаял',
    duration: 260,
    interactivity: 'timing',
    reward: { stars: 20, friend: 'snowman' },
    narrative: {
      ru: 'Солнце вышло, и снеговик тает. Принеси три куска снега, пока он не растаял совсем.',
      kk: 'Күн шығып, аққала еріп барады. Толық ерімей тұрып, үш кесек қар әкел.',
    },
  },
  {
    id: 16,
    chapter: 2,
    title: 'Зимний QR-сундук',
    description: 'Открой зимний сундук и заверши Сезон 1',
    duration: 200,
    interactivity: 'explore',
    reward: { stars: 30, friend: 'ice_friend_rare' },
    narrative: {
      ru: 'Ледяной сундук с замком-снежинкой. Открой его — внутри карта к Горному озеру и общий снимок друзей.',
      kk: 'Ұлпа-құлыпты мұз сандығы. Аш — ішінде Тау көліне карта және достардың ортақ суреті.',
    },
  },
];

export function getLevelConfig(levelId: number): LevelConfig | undefined {
  return LEVEL_CONFIGS.find((l) => l.id === levelId);
}

export function getLevelsByChapter(chapter: 1 | 2) {
  return LEVEL_CONFIGS.filter((l) => l.chapter === chapter);
}

export function getChapterProgress(chapter: 1 | 2, completedLevels: number[]) {
  const chapterLevels = getLevelsByChapter(chapter);
  const completed = chapterLevels.filter((l) => completedLevels.includes(l.id)).length;
  return {
    total: chapterLevels.length,
    completed,
    percentage: chapterLevels.length
      ? Math.round((completed / chapterLevels.length) * 100)
      : 0,
  };
}
