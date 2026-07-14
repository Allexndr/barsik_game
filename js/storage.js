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
    tasksDone: {}, tasksDate: null,
    totalStars: 0, totalPlayed: 0, perfectLevels: 0,
    cityDecor: [],
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
