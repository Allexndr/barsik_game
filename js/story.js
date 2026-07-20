// ===== Story / Season 1 episodes (GDD v2) =====
const STORY = {
  seasonId: 's1_first_friends',
  seasonTitle: 'Сезон 1: Первые друзья',
  friendAyaId: 'aya',
};

/** Episodes for vertical slice — not lane-runner */
const STORY_EPISODES = [
  {
    id: 'ep0_wake',
    title: 'Пробуждение',
    world: 'hub',
    goal: 'Выйди из дома на площадь',
    lines: [
      { who: 'Барсик', ru: 'Доброе утро, город… Странно. Тихо.', kk: 'Қайырлы таң, қала… Тыныш екен.' },
      { who: 'Барсик', ru: 'Друзья где-то ждут. Пойду искать!', kk: 'Достар бір жерде күтіп тұр. Іздеп көрейін!' },
    ],
  },
  {
    id: 'ep2_apples',
    title: 'Тропа яблок',
    world: 'fruit_forest',
    goal: 'Собери 3 яблока-указателя',
    needCollect: 3,
    linesStart: [
      { who: 'Барсик', ru: 'Кто-то грыз яблоки… совсем крошечный!', kk: 'Біреу алмаларды тістеген… кішкентай ғой!' },
    ],
    linesEnd: [
      { who: 'Барсик', ru: 'Следы ведут глубже в лес. Пойду дальше!', kk: 'Іздер орманға апарады. Жалғастырайын!' },
    ],
  },
  {
    id: 'ep6_aya',
    title: 'Встреча с Айей',
    world: 'fruit_forest',
    goal: 'Найди Айю и помоги ей',
    unlockFriend: 'aya',
    linesStart: [
      { who: 'Барсик', ru: 'Слышу голос… Кто-то запутался!', kk: 'Дауыс естимін… Біреу шатасып қалған!' },
    ],
    linesMeet: [
      { who: 'Айя', ru: 'Я запуталась в нитях Путало… Он не злой. Он просто всех останавливает.', kk: 'Мен Путалоның жіптеріне оранып қалдым… Ол жаман емес.' },
      { who: 'Барсик', ru: 'Я помогу тебе. Будем друзьями?', kk: 'Мен көмектесемін. Достасайық па?' },
      { who: 'Айя', ru: 'Да! В городе буду ждать у ягодного фонаря. Если понадоблюсь — позови.', kk: 'Иә! Қалада жидек шамының жанында күтемін.' },
    ],
  },
];

function storyEp(id) {
  return STORY_EPISODES.find((e) => e.id === id);
}

function nextStoryEpisode(s) {
  const done = (s.storyDone || []);
  if (!done.includes('ep2_apples')) return 'ep2_apples';
  if (!done.includes('ep6_aya')) return 'ep6_aya';
  return null;
}

function storyProgressLabel(s) {
  const done = (s.storyDone || []).length;
  if ((s.friends || []).includes('aya') || (s.friends || []).includes(STORY.friendAyaId)) {
    return 'Айя нашлась! Можно к сундуку чудес';
  }
  if (done === 0) return 'Следуй в Фруктовый лес — найди следы друга';
  if (!done.includes('ep6_aya')) return 'Айя где-то в лесу — помоги ей!';
  return 'История продолжается…';
}
