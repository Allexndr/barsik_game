// ===== Game Data =====
const WORLDS = [
  { id:'fruit_forest', name:'Фруктовый лес', icon:'assets/icon_fruit_forest.png', bg:'assets/bg_fruit_forest.png', emoji:'🍓', color:'#00b894', levels:range(1,17), pos:{x:22,y:15}, posDesk:{x:9,y:50} },
  { id:'ice_valley', name:'Ледяная долина', icon:'assets/icon_ice_valley.png', bg:'assets/bg_ice_valley.png', emoji:'❄️', color:'#0984e3', levels:range(18,34), pos:{x:74,y:16}, posDesk:{x:25,y:26} },
  { id:'rainbow', name:'Радужная страна', icon:'assets/icon_rainbow.png', bg:'assets/bg_rainbow_country.png', emoji:'🌈', color:'#fd79a8', levels:range(35,50), pos:{x:80,y:42}, posDesk:{x:50,y:32} },
  { id:'mountains', name:'Горы Барсика', icon:'assets/icon_mountains.png', bg:'assets/bg_mountains.png', emoji:'🏔️', color:'#8d6e63', levels:range(51,67), pos:{x:17,y:45}, posDesk:{x:34,y:70} },
  { id:'cola_city', name:'Город Колы', icon:'assets/icon_cola_city.png', bg:'assets/bg_cola_city.png', emoji:'🥤', color:'#7e57c2', levels:range(68,83), pos:{x:21,y:76}, posDesk:{x:70,y:52} },
  { id:'friends_city', name:'Город Друзей', icon:'assets/icon_friends_city.png', bg:'assets/bg_friends_city.png', emoji:'🎉', color:'#fdcb6e', levels:range(84,100), pos:{x:73,y:84}, posDesk:{x:90,y:40}, isFinal:true },
];

const DIFFS = [
  { id:'easy', name:'Лёгкое', desc:'3–7 лет', emoji:'🌿', speed:3.5, obs:0.4, mul:1 },
  { id:'medium', name:'Смелое', desc:'7–10 лет', emoji:'⚡', speed:5, obs:0.8, mul:1.5 },
  { id:'hard', name:'Супер', desc:'11+', emoji:'👑', speed:6.5, obs:1.2, mul:2 },
];

const FRIENDS = [
  {id:1,name:'Маша',emoji:'🐱',icon:'assets/friends/masha.png',rarity:'common',desc:'Рыжая кошечка, любит клубничку',level:5},
  {id:2,name:'Пушок',emoji:'🐰',icon:'assets/friends/pushok.png',rarity:'common',desc:'Белый зайчик, прыгает выше всех',level:10},
  {id:3,name:'Снежок',emoji:'🐻‍❄️',icon:'assets/friends/snezhok.png',rarity:'common',desc:'Белый медвежонок, не боится холода',level:15},
  {id:4,name:'Лисёнок',emoji:'🦊',icon:'assets/friends/lis.png',rarity:'common',desc:'Оранжевый лис, любит загадки',level:20},
  {id:5,name:'Радуга',emoji:'🦄',icon:'assets/friends/raduga.png',rarity:'rare',desc:'Единорог, исполняет желания',level:25},
  {id:6,name:'Пингвин',emoji:'🐧',icon:'assets/friends/pingvin.png',rarity:'common',desc:'Ловкий пингвин, отлично скользит',level:30},
  {id:7,name:'Дракончик',emoji:'🐲',icon:'assets/friends/drakon.png',rarity:'rare',desc:'Маленький дракон, мыльные пузыри',level:35},
  {id:8,name:'Обезьянка',emoji:'🐵',icon:'assets/friends/obezyana.png',rarity:'common',desc:'Весёлая мартышка, любит бананы',level:40},
  {id:9,name:'Панда',emoji:'🐼',icon:'assets/friends/panda.png',rarity:'rare',desc:'Добрая панда, ест бамбук',level:45},
  {id:10,name:'Львёнок',emoji:'🦁',icon:'assets/friends/lvenok.png',rarity:'rare',desc:'Храбрый львёнок, будущий король',level:50},
  {id:11,name:'Тигрёнок',emoji:'🐯',icon:'assets/friends/tigrenok.png',rarity:'rare',desc:'Полосатый тигр, быстрый как ветер',level:55},
  {id:12,name:'Коала',emoji:'🐨',icon:'assets/friends/koala.png',rarity:'common',desc:'Сонная коала, обнимает деревья',level:60},
  {id:13,name:'Жираф',emoji:'🦒',icon:'assets/friends/zhiraf.png',rarity:'rare',desc:'Высокий жираф, видит далеко',level:65},
  {id:14,name:'Зебра',emoji:'🦓',icon:'assets/friends/zebra.png',rarity:'common',desc:'Полосатая зебра, любит бегать',level:70},
  {id:15,name:'Слонёнок',emoji:'🐘',icon:'assets/friends/slon.png',rarity:'rare',desc:'Сильный слонёнок, добрый великан',level:75},
  {id:16,name:'Котёнок',emoji:'🐈',icon:'assets/friends/kot.png',rarity:'common',desc:'Маленький котёнок, всегда рядом',level:80},
  {id:17,name:'Щенок',emoji:'🐕',icon:'assets/friends/shchenok.png',rarity:'common',desc:'Верный щенок, лучший друг',level:85},
  {id:18,name:'Хомяк',emoji:'🐹',icon:'assets/friends/homjak.png',rarity:'common',desc:'Маленький хомяк, запасливый друг',level:90},
  {id:19,name:'Маг',emoji:'🧙',icon:'assets/friends/mag.png',rarity:'legendary',desc:'Волшебник, знает все секреты',level:95},
  {id:20,name:'Фея',emoji:'🧚',icon:'assets/friends/feya.png',rarity:'legendary',desc:'Лесная фея, дарит звёзды',level:100},
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
  {thr:1,emoji:'🏠',icon:'assets/city/house.png'},
  {thr:2,emoji:'🌳',icon:'assets/city/tree.png'},
  {thr:3,emoji:'🏞️',icon:'assets/city/fountain.png'},
  {thr:5,emoji:'☕',icon:'assets/city/cafe.png'},
  {thr:7,emoji:'⛲',icon:'assets/city/shop.png'},
  {thr:9,emoji:'🎡',icon:'assets/city/park.png'},
  {thr:12,emoji:'⚽',icon:'assets/city/ball.png'},
  {thr:15,emoji:'🏰',icon:'assets/city/castle.png'},
  {thr:20,emoji:'🎆',icon:'assets/city/firework.png'},
];

const COSTUMES = [
  {id:'default',name:'Обычный',emoji:'🐱',icon:'assets/barsik_idle.png',price:0},
  {id:'superhero',name:'Супергерой',emoji:'🦸',icon:'assets/chars/barsik_superhero.png',price:50},
  {id:'wizard',name:'Волшебник',emoji:'🧙',icon:'assets/chars/barsik_wizard.png',price:80},
  {id:'astronaut',name:'Космонавт',emoji:'👨‍🚀',icon:'assets/chars/barsik_astronaut.png',price:120},
  {id:'pirate',name:'Пират',emoji:'🏴‍☠️',icon:'assets/chars/barsik_pirate.png',price:100},
  {id:'rainbow',name:'Радужный',emoji:'🌈',icon:'assets/chars/barsik_rainbow.png',price:200},
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
