// Конфигурация уровней для первого сезона
// Глава 1: Фруктовый лес (10 уровней)

export const LEVEL_CONFIGS = [
  // ГЛАВА 1: Фруктовый лес (уровни 0-9)
  {
    id: 0,
    chapter: 1,
    title: "Пробуждение Барсика",
    description: "Барсик просыпается в своём домике и видит волшебный мир",
    duration: 30,
    interactivity: "explore",
    reward: { stars: 10, friend: null },
    narrative: {
      ru: "Утро в Стране Барсика начинается. Из окна домика видны гигантские фрукты...",
      kk: "Барсик Елеуінің таңы басталады. Үй терезесінен көлемді жемістер көрінеді...",
    },
  },
  {
    id: 1,
    chapter: 1,
    title: "Первые шаги в лесу",
    description: "Выйди на лесную тропинку и собери фрукты",
    duration: 40,
    interactivity: "find",
    reward: { stars: 15, friend: null },
    narrative: {
      ru: "Лесная дорожка светит под лучами солнца. Нужно собрать яблоки...",
      kk: "Ормандық жол күн сәулесінде жарқырайды. Алма жинау керек...",
    },
  },
  {
    id: 2,
    chapter: 1,
    title: "Фруктовая поляна",
    description: "Помоги садовнику разложить фрукты по цветам",
    duration: 35,
    interactivity: "help",
    reward: { stars: 12, friend: null },
    narrative: {
      ru: "На поляне работает маленький Барсик-садовник. Помоги ему!",
      kk: "Орынға кішіпе Барсик ауыл шаруашысы істеп жұмыс істеп тұр.",
    },
  },
  {
    id: 3,
    chapter: 1,
    title: "Потерявшийся фрукт",
    description: "Найди золотистый фрукт среди деревьев",
    duration: 50,
    interactivity: "find",
    reward: { stars: 20, friend: null },
    narrative: {
      ru: "Кто-то потерял особый золотистый фрукт. Помоги найти его!",
      kk: "Біреу ерекше алтын түсті жемісті жоғалтты. Табуға көмектес!",
    },
  },
  {
    id: 4,
    chapter: 1,
    title: "Лесной мостик",
    description: "Осторожно пройди по качающемуся мостику",
    duration: 30,
    interactivity: "timing",
    reward: { stars: 15, friend: null },
    narrative: {
      ru: "Мостик качается. Нужно идти очень осторожно...",
      kk: "Көпірі тербелінеді. Өте сақ жүру керек...",
    },
  },
  {
    id: 5,
    chapter: 1,
    title: "Помощь другу с корзиной",
    description: "Помоги другому Барсику нести корзину",
    duration: 35,
    interactivity: "help",
    reward: { stars: 18, friend: "gardener" },
    narrative: {
      ru: "Маленький Барсик устал нести корзину. Помоги ему!",
      kk: "Кішіпе Барсик сәндегіні көліктеу ісінде шаршады. Оған көмектес!",
    },
  },
  {
    id: 6,
    chapter: 1,
    title: "Лесная загадка",
    description: "Выбери правильное дерево по загадке",
    duration: 40,
    interactivity: "choice",
    reward: { stars: 16, friend: null },
    narrative: {
      ru: "На полянке три деревца. Какое любит красные яблоки?",
      kk: "Орынға үш ағаш бар. Қайсысы қызыл алма ұнатады?",
    },
  },
  {
    id: 7,
    chapter: 1,
    title: "Встреча с первым другом",
    description: "Познакомься с Путало, фотографом из леса",
    duration: 60,
    interactivity: "explore",
    reward: { stars: 25, friend: "putalo" },
    narrative: {
      ru: "Барсик встречает Путало — стеснительного фотографа. Они становятся друзьями!",
      kk: "Барсик Путало-ны кездестіреді — ұялшақ фотограф. Олар достар болады!",
    },
  },
  {
    id: 8,
    chapter: 1,
    title: "Мини-праздник в лесу",
    description: "Помоги украсить поляну к маленькому празднику",
    duration: 45,
    interactivity: "help",
    reward: { stars: 20, friend: null },
    narrative: {
      ru: "Все друзья собрались! Нужно развесить гирлянды и украшения.",
      kk: "Барлық достар жиналды! Гирляндалар мен безендіруді ілу керек.",
    },
  },
  {
    id: 9,
    chapter: 1,
    title: "Первый QR-сундук",
    description: "Открой волшебный сундук с первой наградой",
    duration: 30,
    interactivity: "explore",
    reward: { stars: 30, friend: "rare_friend_1" },
    narrative: {
      ru: "Барсик находит сияющий сундук! Это результат прохождения первой главы!",
      kk: "Барсик сәлсіде сәндегі сундықты табады! Бұл бірінші бөлімді аяқтау құнды!",
    },
  },

  // ГЛАВА 2: Ледяная долина (уровни 10-19)
  {
    id: 10,
    chapter: 2,
    title: "Дорога к снегу",
    description: "Начни подъём к ледяной долине",
    duration: 35,
    interactivity: "explore",
    reward: { stars: 15, friend: null },
    narrative: {
      ru: "Барсик и друзья выходят к подножию гор. Впереди видны заснеженные вершины!",
      kk: "Барсик және достары таулар жалындағы аралыққа шығады. Алда қарды шыңдар көрінеді!",
    },
  },
  {
    id: 11,
    chapter: 2,
    title: "Первые снежинки",
    description: "Лови падающие снежинки в воздухе",
    duration: 40,
    interactivity: "timing",
    reward: { stars: 18, friend: null },
    narrative: {
      ru: "Идёт лёгкий снег. Барсик играет со снежинками, ловит их!",
      kk: "Жеңіл қар идеді. Барсик қарсы снежинкалармен ойнайды!",
    },
  },
  {
    id: 12,
    chapter: 2,
    title: "Ледяная тропинка",
    description: "Проходи осторожно по скользкой дорожке",
    duration: 50,
    interactivity: "timing",
    reward: { stars: 20, friend: null },
    narrative: {
      ru: "Узкая ледяная тропинка. Нужно идти аккуратно, чтобы не поскользнуться!",
      kk: "Тар мұз жолы.滑らないように注意が必要です。",
    },
  },
  {
    id: 13,
    chapter: 2,
    title: "Ледяные фигурки",
    description: "Помоги мастеру льда дорезать скульптуры",
    duration: 40,
    interactivity: "help",
    reward: { stars: 16, friend: "ice_sculptor" },
    narrative: {
      ru: "Мастер льда создаёт красивые скульптуры! Давай поможем!",
      kk: "Мұз ұста әдемі скульптуралар жасап жатыр! Көмектесейік!",
    },
  },
  {
    id: 14,
    chapter: 2,
    title: "Холодно — делимся теплом",
    description: "Помоги другу согреться, поделись шарфом",
    duration: 35,
    interactivity: "help",
    reward: { stars: 22, friend: null },
    narrative: {
      ru: "Одному из друзей очень холодно. Поделись теплом и помощью!",
      kk: "Бір достының өте суық. Жылылық пен көмекті бөліс!",
    },
  },
  {
    id: 15,
    chapter: 2,
    title: "Ледяная горка",
    description: "Подготовь ледяную горку для катания",
    duration: 45,
    interactivity: "help",
    reward: { stars: 18, friend: null },
    narrative: {
      ru: "Давай сделаем супер горку для катания! Это будет весело!",
      kk: "Супер түскендік жасайық! Бұл қызық болады!",
    },
  },
  {
    id: 16,
    chapter: 2,
    title: "Спасти снежного друга",
    description: "Помоги спасти таящего снеговика",
    duration: 40,
    interactivity: "help",
    reward: { stars: 20, friend: "snowman" },
    narrative: {
      ru: "Снеговик начинает таять! Нужно быстро его спасти!",
      kk: "Қарлақал еріп барады! Оны тез құтқару керек!",
    },
  },
  {
    id: 17,
    chapter: 2,
    title: "Ночная долина",
    description: "Зажги фонарики, чтобы осветить ночной путь",
    duration: 35,
    interactivity: "help",
    reward: { stars: 16, friend: null },
    narrative: {
      ru: "Наступила ночь. Давай зажжём фонарики для безопасности!",
      kk: "Түн келді. Қауіпсіздік үшін фонарықтарды өшір!",
    },
  },
  {
    id: 18,
    chapter: 2,
    title: "Зимний хоровод",
    description: "Танцуй в хороводе со всеми друзьями",
    duration: 50,
    interactivity: "explore",
    reward: { stars: 25, friend: null },
    narrative: {
      ru: "Все друзья танцуют вместе! Присоединяйся к хороводу!",
      kk: "Барлық достар бірге билейді! Хороводға қосыл!",
    },
  },
  {
    id: 19,
    chapter: 2,
    title: "Зимний QR-сундук",
    description: "Открой зимний сундук с ледяной наградой",
    duration: 30,
    interactivity: "explore",
    reward: { stars: 30, friend: "ice_friend" },
    narrative: {
      ru: "Вторая глава завершена! Ледяная долина подарила вам чудесного друга!",
      kk: "Екінші бөлім аяқталды! Мұз аңғарасы сіздерге құдіректі досын берді!",
    },
  },

  // TODO: ГЛАВА 3-6 аналогично (Город Колы, Радужная страна, Горы Барсика, Город Друзей)
  // Пока создам заготовки
  ...Array.from({ length: 40 }).map((_, i) => ({
    id: 20 + i,
    chapter: Math.floor((20 + i) / 10) + 1,
    title: `Уровень ${21 + i}`,
    description: `Эпизод ${21 + i}`,
    duration: 30 + Math.random() * 30,
    interactivity: ["explore", "find", "help", "choice", "timing"][Math.floor(Math.random() * 5)] as any,
    reward: {
      stars: 10 + Math.floor(Math.random() * 20),
      friend: Math.random() > 0.7 ? `friend_${i}` : null,
    },
    narrative: {
      ru: `Эпизод ${21 + i} - интересная история!`,
      kk: `${21 + i}-эпизод - қызықты түрлі!`,
    },
  })),
];

export function getLevelConfig(levelId: number) {
  return LEVEL_CONFIGS[levelId];
}

export function getLevelsByChapter(chapter: number) {
  return LEVEL_CONFIGS.filter((l) => l.chapter === chapter);
}

export function getChapterProgress(chapter: number, completedLevels: number[]) {
  const chapterLevels = getLevelsByChapter(chapter);
  const completed = chapterLevels.filter((l) => completedLevels.includes(l.id)).length;
  return {
    total: chapterLevels.length,
    completed,
    percentage: Math.round((completed / chapterLevels.length) * 100),
  };
}
