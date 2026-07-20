// ===== Storage =====
const KEY = 'barsik_v2';

function defaultState() {
  return {
    stars: 0, completed: [], unlocked: [1], friends: [],
    difficulty: 'easy', qrOpened: 0, dailyStreak: 0,
    lastVisit: null, name: 'Игрок', sound: true,
    costume: 'default', ownedCostumes: ['default'],
    ownedEmotes: ['wave'], emote: 'wave',
    boosters: { shield: 0, magnet: 0, speed: 0 },
    invited: 0, inviteBonus: 0,
    tasksDone: {}, tasksDate: null, achievementsDone: {},
    totalStars: 0, totalPlayed: 0, perfectLevels: 0,
    achievements: [], cityDecor: [], hasLoggedIn: false, referredBy: null,
    // GDD v2 onboarding / story
    gender: null,           // 'boy' | 'girl'
    phone: '',
    ageCategory: 'b',       // 'a' | 'b' | 'c'
    lang: 'ru',             // 'ru' | 'kk'
    accessories: { hat: false, glasses: false },
    storyDone: [],          // episode ids
    seasonId: 's1_first_friends',
    snackDoneToday: false,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  } catch { return defaultState(); }
}

function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  if (typeof Cloud !== 'undefined') Cloud.schedulePush(s);
}

function reset() { localStorage.removeItem(KEY); }

function checkDaily(s) {
  const today = new Date().toDateString();
  if (s.lastVisit !== today) {
    const y = new Date(Date.now() - 86400000).toDateString();
    s.dailyStreak = (s.lastVisit === y) ? s.dailyStreak + 1 : 1;
    s.lastVisit = today;
    const bonus = 5 + Math.min(s.dailyStreak, 10);
    s.stars += bonus;
    s.tasksDate = today;
    s.tasksDone = {};
    save(s);
    return bonus;
  }
  return 0;
}

const MILESTONES = [
  {id:'first_run', title:'Первый бег!', desc:'Пройди уровень', check:(s)=>s.completed.length>=1},
  {id:'collector', title:'Собиратель', desc:'Собери 50 звёзд за раз', check:(s,r)=>r&&r.stars>=50},
  {id:'perfect', title:'Безупречно', desc:'Пройди уровень без ошибок', check:(s,r)=>r&&r.hits===0},
  {id:'combo_master', title:'Комбо-мастер', desc:'Собери 15 звёзд подряд', check:(s,r)=>r&&r.maxCombo>=15},
  {id:'friend_5', title:'Компания', desc:'Найди 5 друзей', check:(s)=>s.friends.length>=5},
  {id:'city_builder', title:'Градостроитель', desc:'Открой 5 украшений', check:(s)=>s.friends.length>=9},
];

function awardMilestone(s, id) {
  if (s.achievements.includes(id)) return false;
  const m = MILESTONES.find(x => x.id === id);
  if (!m) return false;
  s.achievements.push(id);
  save(s);
  if (typeof toast === 'function') setTimeout(() => toast(`Достижение: ${m.title}! ✨`, 'success'), 500);
  return true;
}

function checkMilestones(s, r) {
  MILESTONES.forEach(m => { if (m.check(s, r)) awardMilestone(s, m.id); });
}

function getReturnMessage(s) {
  if (!s.lastVisit) return null;
  const days = Math.floor((Date.now() - new Date(s.lastVisit).getTime()) / 86400000);
  if (days < 2) return null;
  const msgs = [
    'Барсик скучает по тебе! 🐱',
    'Твой друг почти дошел до Города Друзей! 🎉',
    'Сегодня появился новый друг! 🌟',
    'На этой неделе можно открыть редкого Барсика! ✨',
  ];
  return msgs[Math.min(days - 2, msgs.length - 1)];
}

function trackTask(s, type, value) {
  const today = new Date().toDateString();
  if (s.tasksDate !== today) { s.tasksDate = today; s.tasksDone = {}; }
  TASKS.forEach(t => {
    if (t.type === type) {
      const cur = s.tasksDone[t.id] || 0;
      s.tasksDone[t.id] = Math.min(t.target, cur + value);
    }
  });
}

function claimTask(s, taskId) {
  const t = TASKS.find(x => x.id === taskId);
  if (!t) return false;
  const prog = s.tasksDone[taskId] || 0;
  if (prog < t.target) return false;
  if (s.tasksDone[taskId + '_claimed']) return false;
  s.tasksDone[taskId + '_claimed'] = true;
  s.stars += t.reward;
  save(s);
  return true;
}
