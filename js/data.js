// ===== Game Data =====
const WORLDS = [
  { id:'fruit_forest', name:'Фруктовый лес', icon:'assets/icon_fruit_forest.png', bg:'assets/bg_fruit_forest.png', emoji:'🍓', color:'#00b894', levels:range(1,17), pos:{x:18,y:58} },
  { id:'ice_valley', name:'Ледяная долина', icon:'assets/icon_ice_valley.png', bg:'assets/bg_ice_valley.png', emoji:'❄️', color:'#0984e3', levels:range(18,34), pos:{x:36,y:28} },
  { id:'rainbow', name:'Радужная страна', icon:'assets/icon_rainbow.png', bg:'assets/bg_rainbow_country.png', emoji:'🌈', color:'#fd79a8', levels:range(35,50), pos:{x:52,y:62} },
  { id:'mountains', name:'Горы Барсика', icon:'assets/icon_mountains.png', bg:'assets/bg_mountains.png', emoji:'🏔️', color:'#8d6e63', levels:range(51,67), pos:{x:68,y:22} },
  { id:'cola_city', name:'Город Колы', icon:'assets/icon_cola_city.png', bg:'assets/bg_cola_city.png', emoji:'🥤', color:'#7e57c2', levels:range(68,83), pos:{x:80,y:52} },
  { id:'friends_city', name:'Город Друзей', icon:'assets/icon_friends_city.png', bg:'assets/bg_friends_city.png', emoji:'🎉', color:'#fdcb6e', levels:range(84,100), pos:{x:90,y:78}, isFinal:true },
];

const DIFFS = [
  { id:'easy', name:'Лёгкое', desc:'3–7 лет', emoji:'🌿', speed:3.5, obs:0.4, mul:1 },
  { id:'medium', name:'Смелое', desc:'7–10 лет', emoji:'⚡', speed:5, obs:0.8, mul:1.5 },
  { id:'hard', name:'Супер', desc:'11+', emoji:'👑', speed:6.5, obs:1.2, mul:2 },
];

const FRIENDS = [
  {id:1,name:'Маша',emoji:'🐱',rarity:'common',desc:'Рыжая кошечка, любит клубничку'},
  {id:2,name:'Пушок',emoji:'🐰',rarity:'common',desc:'Белый зайчик, прыгает выше всех'},
  {id:3,name:'Снежок',emoji:'🐻‍❄️',rarity:'common',desc:'Белый медвежонок, не боится холода'},
  {id:4,name:'Лисёнок',emoji:'🦊',rarity:'common',desc:'Оранжевый лис, любит загадки'},
  {id:5,name:'Радуга',emoji:'🦄',rarity:'rare',desc:'Единорог, исполняет желания'},
  {id:6,name:'Пингвин',emoji:'🐧',rarity:'common',desc:'Ловкий пингвин, отлично скользит'},
  {id:7,name:'Дракончик',emoji:'🐲',rarity:'rare',desc:'Маленький дракон, мыльные пузыри'},
  {id:8,name:'Обезьянка',emoji:'🐵',rarity:'common',desc:'Весёлая мартышка, любит бананы'},
  {id:9,name:'Панда',emoji:'🐼',rarity:'rare',desc:'Добрая панда, ест бамбук'},
  {id:10,name:'Львёнок',emoji:'🦁',rarity:'rare',desc:'Храбрый львёнок, будущий король'},
  {id:11,name:'Тигрёнок',emoji:'🐯',rarity:'rare',desc:'Полосатый тигр, быстрый как ветер'},
  {id:12,name:'Коала',emoji:'🐨',rarity:'common',desc:'Сонная коала, обнимает деревья'},
  {id:13,name:'Жираф',emoji:'🦒',rarity:'rare',desc:'Высокий жираф, видит далеко'},
  {id:14,name:'Зебра',emoji:'🦓',rarity:'common',desc:'Полосатая зебра, любит бегать'},
  {id:15,name:'Слонёнок',emoji:'🐘',rarity:'rare',desc:'Сильный слонёнок, добрый великан'},
  {id:16,name:'Котёнок',emoji:'🐈',rarity:'common',desc:'Маленький котёнок, всегда рядом'},
  {id:17,name:'Щенок',emoji:'🐕',rarity:'common',desc:'Верный щенок, лучший друг'},
  {id:18,name:'Хомяк',emoji:'🐹',rarity:'common',desc:'Маленький хомяк, запасливый друг'},
  {id:19,name:'Маг',emoji:'🧙',rarity:'legendary',desc:'Волшебник, знает все секреты'},
  {id:20,name:'Фея',emoji:'🧚',rarity:'legendary',desc:'Лесная фея, дарит звёзды'},
];

const QR_REWARDS = [
  {type:'friend',icon:'🐱',title:'Новый друг!',desc:'Редкий друг присоединился!'},
  {type:'costume',icon:'🎭',title:'Костюм',desc:'Новый костюм для Барсика!'},
  {type:'stars',icon:'⭐',title:'Звёзды дружбы',desc:'+50 звёзд дружбы!'},
  {type:'secret',icon:'🔐',title:'Секретный уровень',desc:'Открыт секретный уровень!'},
  {type:'decor',icon:'🏙️',title:'Украшение',desc:'Новое украшение для города!'},
  {type:'booster',icon:'⚡',title:'Ускоритель',desc:'Ускоритель на 3 уровня!'},
];

const PRIZES = [
  {lvl:20,name:'Наклейки',emoji:'🎁'},
  {lvl:40,name:'Кружка BARSIK',emoji:'🎁'},
  {lvl:60,name:'Футболка',emoji:'🎁'},
  {lvl:80,name:'Рюкзак',emoji:'🎁'},
  {lvl:100,name:'Розыгрыш приза',emoji:'🏆'},
];

const CITY_OBJS = [
  {thr:1,emoji:'🏠'},{thr:2,emoji:'🌳'},{thr:3,emoji:'🏞️'},{thr:5,emoji:'☕'},
  {thr:7,emoji:'⛲'},{thr:9,emoji:'🎡'},{thr:12,emoji:'⚽'},{thr:15,emoji:'🏰'},{thr:20,emoji:'🎆'},
];

const COSTUMES = [
  {id:'default',name:'Обычный',emoji:'🐱',price:0},
  {id:'superhero',name:'Супергерой',emoji:'🦸',price:50},
  {id:'wizard',name:'Волшебник',emoji:'🧙',price:80},
  {id:'astronaut',name:'Космонавт',emoji:'👨‍🚀',price:120},
  {id:'pirate',name:'Пират',emoji:'🏴‍☠️',price:100},
  {id:'rainbow',name:'Радужный',emoji:'🌈',price:200},
];

const EMOTES = [
  {id:'wave',name:'Привет',emoji:'👋',price:10},
  {id:'dance',name:'Танец',emoji:'💃',price:20},
  {id:'laugh',name:'Смех',emoji:'😂',price:15},
  {id:'cool',name:'Крутой',emoji:'😎',price:25},
  {id:'love',name:'Любовь',emoji:'😍',price:15},
  {id:'star',name:'Звезда',emoji:'🌟',price:30},
];

const TASKS = [
  {id:'play3',desc:'Сыграй 3 уровня',target:3,type:'play',reward:15},
  {id:'stars50',desc:'Собери 50 звёзд',target:50,type:'collect',reward:20},
  {id:'friend',desc:'Найди нового друга',target:1,type:'friend',reward:25},
  {id:'daily',desc:'Зайди в игру',target:1,type:'visit',reward:5},
  {id:'qr',desc:'Открой сундук',target:1,type:'qr',reward:15},
  {id:'perfect',desc:'Пройди уровень без ошибок',target:1,type:'perfect',reward:30},
];

const BOOSTERS = [
  {id:'shield',name:'Щит',emoji:'🛡️',desc:'Защита от 1 препятствия'},
  {id:'magnet',name:'Магнит',emoji:'🧲',desc:'Притягивает звёзды'},
  {id:'speed',name:'Ускоритель',emoji:'⚡',desc:'+50% звёзд за уровень'},
];

const SEASONS = [
  {id:'summer',name:'Лето',emoji:'☀️',friends:['season1'],active:false},
  {id:'winter',name:'Зима',emoji:'❄️',friends:['season2'],active:false},
];

function range(a,b){ const r=[]; for(let i=a;i<=b;i++) r.push(i); return r; }
function worldByLevel(l){ return WORLDS.find(w=>w.levels.includes(l)) || WORLDS[0]; }
function friendAtLevel(l){ if(l%5!==0) return null; return FRIENDS[Math.floor(l/5)-1] || null; }
function getCostume(id){ return COSTUMES.find(c=>c.id===id) || COSTUMES[0]; }
