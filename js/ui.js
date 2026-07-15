// ===== UI Screens =====
let S = null;
let curDiff = 'easy';
let curWorld = null;

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast-msg ' + type;
  el.textContent = msg;
  t.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function updateMenu(s) {
  document.getElementById('menu-stars').textContent = s.stars;
  document.getElementById('menu-friends-count').textContent = s.friends.length;
  const prog = document.getElementById('menu-progress');
  const bar = document.getElementById('menu-progress-bar');
  if (!prog || !bar) return;
  const nextPrize = PRIZES.find(p => p.lvl > s.completed.length);
  if (nextPrize) {
    prog.style.display = 'flex';
    const lvl = s.completed.length;
    const prev = PRIZES.filter(p => p.lvl < nextPrize.lvl).pop();
    const base = prev ? prev.lvl : 0;
    const pct = Math.min(100, Math.max(0, (lvl - base) / (nextPrize.lvl - base) * 100));
    bar.style.width = pct + '%';
  } else {
    prog.style.display = 'none';
  }
}

function renderDiff() {
  const list = document.getElementById('diff-list');
  list.innerHTML = '';
  DIFFS.forEach(d => {
    const c = document.createElement('div');
    c.className = 'diff-card' + (curDiff === d.id ? ' selected' : '');
    c.innerHTML = `<div class="diff-emoji" aria-hidden="true"><img src="assets/icons/items/star.svg" alt="" class="inline-icon"></div><h3>${d.name} приключение</h3><p>${d.desc}</p>`;
    c.onclick = () => {
      Sound.click();
      curDiff = d.id;
      S.difficulty = d.id;
      save(S);
      renderDiff();
      setTimeout(() => { show('map'); renderMap(S); }, 250);
    };
    list.appendChild(c);
  });
}

function renderMap(s) {
  document.getElementById('map-stars').textContent = s.stars;
  document.getElementById('map-friends').textContent = s.friends.length;
  const pins = document.getElementById('map-pins');
  pins.innerHTML = '';
  WORLDS.forEach((w, idx) => {
    const first = w.levels[0];
    const unlocked = s.unlocked.includes(first);
    const doneCnt = w.levels.filter(l => s.completed.includes(l)).length;
    const allDone = doneCnt === w.levels.length;
    const isCur = unlocked && !allDone;
    const p = document.createElement('div');
    p.className = 'map-pin' + (!unlocked ? ' locked' : '') + (allDone ? ' done' : '') + (isCur ? ' current' : '');
    p.style.left = w.pos.x + '%';
    p.style.top = w.pos.y + '%';
    p.innerHTML = `
      <div class="map-pin-disc">
        <img class="map-pin-img" src="${w.icon}" alt="${w.name}">
        ${allDone ? '<div class="map-pin-check"><svg class="pill-ico gold"><use href="#ic-star"/></svg></div>' : ''}
        ${!unlocked ? '<div class="map-pin-lock">🔒</div>' : ''}
      </div>
      <div class="map-pin-label">${w.name}<span class="map-pin-prog">${doneCnt}/${w.levels.length}</span></div>
    `;
    if (unlocked) p.onclick = () => { Sound.click(); curWorld = w; show('levels'); renderLevels(s, w); };
    else p.onclick = () => { Sound.hit(); toast('Пройди предыдущий мир!', 'friend'); };
    p.style.animationDelay = (idx * 0.08) + 's';
    pins.appendChild(p);
  });
}

function renderLevels(s, w) {
  document.getElementById('levels-title').innerHTML = `<img src="${w.icon}" alt="" class="inline-icon"> ${w.name}`;
  const g = document.getElementById('levels-grid');
  g.innerHTML = '';
  w.levels.forEach(lv => {
    const open = s.unlocked.includes(lv);
    const done = s.completed.includes(lv);
    const fr = friendAtLevel(lv);
    const t = document.createElement('div');
    t.className = 'level-tile ' + (!open ? 'locked' : done ? 'done' : 'open');
    t.innerHTML = `${lv}${done?'<div class="check"><img src="assets/icons/items/star.svg" alt="" class="inline-icon"></div>':''}${fr&&s.friends.includes(fr.id)?`<div class="friend-mark"><img src="${fr.icon}" alt=""></div>`:''}`;
    if (open) t.onclick = () => { Sound.tap(); startGame(lv, w); };
    t.style.animationDelay = (w.levels.indexOf(lv) * 0.03) + 's';
    g.appendChild(t);
  });
}

function renderCity(s) {
  const o = document.getElementById('city-objects');
  o.innerHTML = '';
  CITY_OBJS.forEach(b => {
    const e = document.createElement('div');
    e.className = 'city-obj' + (s.friends.length >= b.thr ? '' : ' locked');
    e.innerHTML = `<img src="${b.icon}" alt="">${s.friends.length < b.thr ? `<div class="city-obj-lock">${b.thr}</div>` : ''}`;
    e.style.animationDelay = (CITY_OBJS.indexOf(b) * 0.1) + 's';
    o.appendChild(e);
  });
  document.getElementById('city-friends').textContent = s.friends.length;
  document.getElementById('city-buildings').textContent = CITY_OBJS.filter(b => s.friends.length >= b.thr).length;
}

function renderCollection(s) {
  const g = document.getElementById('collection-grid');
  g.innerHTML = '';
  FRIENDS.forEach(f => {
    const has = s.friends.includes(f.id);
    const c = document.createElement('div');
    c.className = 'coll-card' + (has ? '' : ' locked');
    c.innerHTML = `<div class="coll-emoji">${has ? `<img src="${f.icon}" alt="">` : '<img src="assets/icons/items/question.svg" alt="" class="inline-icon">'}</div><div class="coll-name">${has ? f.name : '???'}</div><div class="coll-rarity ${f.rarity}">${f.rarity}</div>`;
    c.onclick = () => { Sound.tap(); renderFriendDetail(f, has); };
    c.style.animationDelay = (FRIENDS.indexOf(f) * 0.03) + 's';
    g.appendChild(c);
  });
}

function renderFriendDetail(f, has) {
  Sound.tap();
  document.getElementById('friend-detail-title').textContent = has ? f.name : '???';
  const c = document.getElementById('friend-detail-content');
  const rarityLabels = { common: 'Обычный', rare: 'Редкий', legendary: 'Легендарный' };
  const world = worldByLevel(f.level);
  c.innerHTML = `
    <div class="fd-hero ${f.rarity}" style="position:relative">
      ${has ? `<img src="${f.icon}" alt="${f.name}">` : '<div class="fd-locked-overlay"><img src="assets/icons/items/question.svg" alt="" class="inline-icon"></div>'}
    </div>
    <div class="fd-name">${has ? f.name : 'Не найден'}</div>
    <div class="fd-rarity ${f.rarity}">${rarityLabels[f.rarity] || f.rarity}</div>
    <div class="fd-desc">${has ? f.desc : 'Найди этого друга в путешествии!'}</div>
    ${has ? `<div class="fd-location"><img src="${world.icon}" alt="" class="inline-icon"> ${world.name} · Ур. ${f.level}</div>` : ''}
  `;
  show('friend-detail');
}

function renderRating(s) {
  const list = document.getElementById('rating-list');
  list.innerHTML = '<div class="rate-row"><div class="rate-name">Загрузка...</div></div>';
  const paint = (data) => {
    list.innerHTML = '';
    const medals = ['1','2','3'];
    data.forEach((d, i) => {
      const r = document.createElement('div');
      r.className = 'rate-row' + (d.me ? ' me' : '');
      r.innerHTML = `<div class="rate-pos">${medals[i] || (i + 1)}</div><div class="rate-av"><svg class="pill-ico"><use href="#ic-paw"/></svg></div><div><div class="rate-name">${d.n}</div><div class="rate-score"><svg class="pill-ico gold"><use href="#ic-star"/></svg> ${d.s}</div></div>`;
      r.style.animationDelay = (i * 0.06) + 's';
      list.appendChild(r);
    });
  };
  const fallback = () => {
    const data = [
      { n: 'Аня', s: 850 }, { n: 'Коля', s: 720 },
      { n: s.name, s: s.stars, me: true },
      { n: 'Лиза', s: 480 }, { n: 'Макс', s: 350 },
      { n: 'Соня', s: 280 }, { n: 'Артём', s: 200 },
    ].sort((a, b) => b.s - a.s);
    paint(data);
  };
  if (typeof Cloud === 'undefined') { fallback(); return; }
  Cloud.leaderboard(20).then(rows => {
    if (!rows || !rows.length) { fallback(); return; }
    const data = rows.map(r => ({
      n: r.name,
      s: r.total_stars || r.stars || 0,
      me: r.name === s.name,
    }));
    // Ensure current player is on the board.
    if (!data.some(d => d.me)) data.push({ n: s.name, s: s.totalStars || s.stars, me: true });
    data.sort((a, b) => b.s - a.s);
    paint(data.slice(0, 20));
  }).catch(fallback);
}

function openChest(s) {
  Sound.chest();
  document.getElementById('qr-intro').style.display = 'none';
  const res = document.getElementById('qr-result');
  res.style.display = 'flex';
  const rw = QR_REWARDS[Math.floor(Math.random() * QR_REWARDS.length)];
  const iconMap = { friend:'assets/icons/friends/masha.svg', costume:'assets/icons/costumes/wizard.svg', stars:'assets/icons/items/star.svg', secret:'assets/icons/items/lock.svg', decor:'assets/icons/city/house.svg', booster:'assets/icons/items/speed.svg' };
  document.getElementById('qr-reward-icon').innerHTML = `<img src="${iconMap[rw.type] || iconMap.stars}" alt="">`;
  document.getElementById('qr-reward-title').textContent = rw.title;
  document.getElementById('qr-reward-desc').textContent = rw.desc;
  s.qrOpened++;
  trackTask(s, 'qr', 1);
  if (rw.type === 'stars') { s.stars += 50; Sound.star(); }
  else if (rw.type === 'friend') {
    const left = FRIENDS.filter(f => !s.friends.includes(f.id));
    if (left.length) {
      const nf = left[Math.floor(Math.random() * left.length)];
      s.friends.push(nf.id);
      document.getElementById('qr-reward-icon').innerHTML = `<img src="${nf.icon}" alt="">`;
      document.getElementById('qr-reward-desc').textContent = `${nf.name} присоединился!`;
      trackTask(s, 'friend', 1);
      Sound.friend();
    } else {
      s.stars += 100;
      document.getElementById('qr-reward-desc').textContent = 'Все друзья найдены! +100⭐';
      Sound.star();
    }
  } else if (rw.type === 'booster') {
    s.boosters.shield = (s.boosters.shield||0) + 1;
    s.boosters.magnet = (s.boosters.magnet||0) + 1;
    s.boosters.speed = (s.boosters.speed||0) + 1;
    Sound.levelup();
  } else if (rw.type === 'costume') {
    const left = COSTUMES.filter(c => !s.ownedCostumes.includes(c.id) && c.price > 0);
    if (left.length) {
      const nc = left[Math.floor(Math.random() * left.length)];
      s.ownedCostumes.push(nc.id);
      document.getElementById('qr-reward-icon').innerHTML = `<img src="${nc.icon}" alt="">`;
      document.getElementById('qr-reward-desc').textContent = `Костюм: ${nc.name}!`;
      Sound.levelup();
    } else { s.stars += 50; Sound.star(); }
  }
  save(S);
  document.getElementById('qr-opened').textContent = s.qrOpened;
  fireworks();
}

function renderProfile(s) {
  document.getElementById('prof-stars').textContent = s.stars;
  const c = document.getElementById('profile-content');
  const costume = getCostume(s.costume);
  const done = s.completed.length;

  let costumesHtml = '';
  COSTUMES.forEach(c => {
    const owned = s.ownedCostumes.includes(c.id);
    const eq = s.costume === c.id;
    costumesHtml += `<div class="shop-item ${owned?'':'locked'} ${eq?'equipped':''}" data-shop="costume" data-id="${c.id}">
      <div class="shop-emoji"><img src="${c.icon}" alt=""></div><div class="shop-name">${c.name}</div>
      <div class="shop-price">${owned?(eq?'Надет':'Есть'):'⭐'+c.price}</div></div>`;
  });

  let emotesHtml = '';
  EMOTES.forEach(e => {
    const owned = s.ownedEmotes.includes(e.id);
    const eq = s.emote === e.id;
    emotesHtml += `<div class="shop-item ${owned?'':'locked'} ${eq?'equipped':''}" data-shop="emote" data-id="${e.id}">
      <div class="shop-emoji"><img src="assets/icons/items/smile.svg" alt=""></div><div class="shop-name">${e.name}</div>
      <div class="shop-price">${owned?(eq?'Активна':'Есть'):'⭐'+e.price}</div></div>`;
  });

  let boostersHtml = '';
  BOOSTERS.forEach(b => {
    const cnt = s.boosters[b.id] || 0;
    boostersHtml += `<div class="shop-item"><div class="shop-emoji"><img src="assets/icons/items/${b.id}.svg" alt=""></div><div class="shop-name">${b.name}</div><div class="shop-price">${cnt} шт.</div></div>`;
  });

  let prizesHtml = '';
  PRIZES.forEach(p => {
    const earned = done >= p.lvl;
    prizesHtml += `<div class="prize-row ${earned?'earned':'locked'}"><span class="prize-emoji"><img src="${earned ? 'assets/icons/items/chest.svg' : 'assets/icons/items/lock.svg'}" alt=""></span><span class="prize-text">Ур. ${p.lvl}: ${p.name}</span><span><img src="${earned ? 'assets/icons/items/check.svg' : 'assets/icons/items/lock.svg'}" alt="" class="inline-icon"></span></div>`;
  });

  c.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar"><img src="${costume.icon}" alt=""></div>
      <div class="profile-info"><div class="profile-name">${s.name}</div><div class="profile-sub">Костюм: ${costume.name}</div></div>
    </div>
    <div class="profile-stats stagger">
      <div class="ps-card"><div class="ps-val">${s.stars}</div><div class="ps-lbl">⭐ Звёзд</div></div>
      <div class="ps-card"><div class="ps-val">${done}</div><div class="ps-lbl">🎮 Уровней</div></div>
      <div class="ps-card"><div class="ps-val">${s.friends.length}</div><div class="ps-lbl">🐱 Друзей</div></div>
      <div class="ps-card"><div class="ps-val">${s.dailyStreak}</div><div class="ps-lbl">🔥 Серия</div></div>
    </div>
    <div class="profile-section" style="animation-delay:0.15s"><h3>🎭 Костюмы</h3><div class="shop-grid stagger">${costumesHtml}</div></div>
    <div class="profile-section" style="animation-delay:0.2s"><h3>😎 Эмоции</h3><div class="shop-grid stagger">${emotesHtml}</div></div>
    <div class="profile-section" style="animation-delay:0.25s"><h3>⚡ Бустеры</h3><div class="shop-grid stagger">${boostersHtml}</div></div>
    <div class="profile-section" style="animation-delay:0.3s"><h3>🎁 Реальные призы</h3><div class="prize-list stagger">${prizesHtml}</div></div>
  `;

  c.querySelectorAll('[data-shop]').forEach(el => {
    el.onclick = () => {
      Sound.tap();
      const shop = el.dataset.shop, id = el.dataset.id;
      if (shop === 'costume') {
        if (S.ownedCostumes.includes(id)) {
          S.costume = id; save(S); renderProfile(S); toast('Костюм надет!'); Sound.levelup();
        } else {
          const co = COSTUMES.find(x=>x.id===id);
          if (S.stars >= co.price) { S.stars -= co.price; S.ownedCostumes.push(id); S.costume = id; save(S); renderProfile(S); toast('Куплен: '+co.name, 'success'); Sound.star(); }
          else { toast('Не хватает звёзд!'); Sound.hit(); }
        }
      } else if (shop === 'emote') {
        if (S.ownedEmotes.includes(id)) {
          S.emote = id; save(S); renderProfile(S); toast('Эмоция активна!'); Sound.levelup();
        } else {
          const em = EMOTES.find(x=>x.id===id);
          if (S.stars >= em.price) { S.stars -= em.price; S.ownedEmotes.push(id); S.emote = id; save(S); renderProfile(S); toast('Куплена: '+em.name, 'success'); Sound.star(); }
          else { toast('Не хватает звёзд!'); Sound.hit(); }
        }
      }
    };
  });
}

function renderTasks(s) {
  const list = document.getElementById('tasks-list');
  list.innerHTML = '';
  const today = new Date().toDateString();
  if (s.tasksDate !== today) { s.tasksDate = today; s.tasksDone = {}; save(s); }

  // Daily quests
  const dailyHeader = document.createElement('div');
  dailyHeader.className = 'tasks-section-title';
  dailyHeader.textContent = 'Ежедневные квесты';
  list.appendChild(dailyHeader);

  TASKS.forEach(t => {
    const prog = s.tasksDone[t.id] || 0;
    const done = prog >= t.target;
    const claimed = s.tasksDone[t.id + '_claimed'];
    const card = document.createElement('div');
    card.className = 'task-card' + (done && !claimed ? ' ready' : '') + (claimed ? ' claimed' : '');
    card.style.animationDelay = (TASKS.indexOf(t) * 0.08) + 's';
    card.innerHTML = `
      <div class="task-icon"><img src="${done ? 'assets/icons/items/check.svg' : 'assets/icons/items/clipboard.svg'}" alt=""></div>
      <div class="task-info"><div class="task-desc">${t.desc}</div>
      <div class="task-progress"><div class="task-bar"><div class="task-bar-fill" style="width:${Math.min(100,(prog/t.target)*100)}%"></div></div>
      <span class="task-count">${prog}/${t.target}</span></div></div>
      <div class="task-reward">${claimed?'<span style="opacity:0.4">⭐'+t.reward+'</span>':`<button class="btn-reward ${done?'':'disabled'}" data-task="${t.id}">⭐ ${t.reward}</button>`}</div>
    `;
    list.appendChild(card);
  });

  // Achievements
  const achHeader = document.createElement('div');
  achHeader.className = 'tasks-section-title';
  achHeader.textContent = 'Достижения';
  list.appendChild(achHeader);

  const achList = [
    {id:'friends', icon:'assets/icons/friends/masha.svg', title:'Коллекционер друзей', get:(s)=>s.friends.length, target:10, reward:50},
    {id:'levels', icon:'assets/icons/items/star.svg', title:'Проходимец', get:(s)=>s.completed.length, target:25, reward:50},
    {id:'stars', icon:'assets/icons/items/star.svg', title:'Звёздочёт', get:(s)=>s.totalStars, target:500, reward:100},
    {id:'perfect', icon:'assets/icons/items/shield.svg', title:'Идеалист', get:(s)=>s.perfectLevels, target:5, reward:75},
  ];
  achList.forEach((a, i) => {
    const prog = a.get(s);
    const done = prog >= a.target;
    const claimed = s.achievementsDone[a.id];
    const card = document.createElement('div');
    card.className = 'task-card' + (done && !claimed ? ' ready' : '') + (claimed ? ' claimed' : '');
    card.style.animationDelay = (0.3 + i * 0.08) + 's';
    card.innerHTML = `
      <div class="task-icon"><img src="${done ? 'assets/icons/items/check.svg' : a.icon}" alt=""></div>
      <div class="task-info"><div class="task-desc">${a.title}</div>
      <div class="task-progress"><div class="task-bar"><div class="task-bar-fill" style="width:${Math.min(100,(prog/a.target)*100)}%"></div></div>
      <span class="task-count">${prog}/${a.target}</span></div></div>
      <div class="task-reward">${claimed?'<span style="opacity:0.4">⭐'+a.reward+'</span>':`<button class="btn-reward ${done?'':'disabled'}" data-ach="${a.id}" data-reward="${a.reward}">⭐ ${a.reward}</button>`}</div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.btn-reward').forEach(b => {
    b.onclick = () => {
      if (b.classList.contains('disabled')) { Sound.hit(); return; }
      if (b.dataset.task) {
        const ok = claimTask(S, b.dataset.task);
        if (ok) { toast('+' + TASKS.find(t=>t.id===b.dataset.task).reward + ' ⭐', 'success'); Sound.star(); renderTasks(S); updateMenu(S); }
      } else if (b.dataset.ach) {
        s.achievementsDone[b.dataset.ach] = true;
        s.stars += parseInt(b.dataset.reward, 10);
        save(s);
        toast('+' + b.dataset.reward + ' ⭐', 'success'); Sound.star(); renderTasks(S); updateMenu(S);
      }
    };
  });
}

function renderInvite(s) {
  const link = location.origin + location.pathname + '?ref=' + encodeURIComponent(s.name);
  document.getElementById('invite-link').value = link;
  document.getElementById('inv-count').textContent = s.invited;
  document.getElementById('inv-bonus').textContent = s.inviteBonus;
}

function fireworks() {
  const c = document.getElementById('qr-fireworks');
  c.innerHTML = '';
  const colors = ['#fd79a8','#fdcb6e','#00b894','#0984e3','#a29bfe','#e17055'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('div');
    p.className = 'qr-spark';
    p.style.left = '50%'; p.style.top = '45%';
    p.style.background = colors[i % colors.length];
    const a = (Math.PI * 2 * i) / 36;
    const d = 80 + Math.random() * 140;
    p.style.setProperty('--tx', Math.cos(a) * d + 'px');
    p.style.setProperty('--ty', Math.sin(a) * d + 'px');
    c.appendChild(p);
  }
}

// ===== Confetti (level complete juice) =====
function celebrateConfetti(host) {
  const target = host || document.getElementById('overlay-result');
  if (!target) return;
  let layer = target.querySelector('.confetti-layer');
  if (layer) layer.remove();
  layer = document.createElement('div');
  layer.className = 'confetti-layer';
  const colors = ['#fd79a8','#fdcb6e','#00b894','#0984e3','#a29bfe','#e17055','#00cec9'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-bit';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.4) + 's';
    p.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    if (Math.random() > 0.5) p.style.borderRadius = '50%';
    layer.appendChild(p);
  }
  target.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}

// ===== Menu Particles =====
let _particleTimer = null;
function startMenuParticles() {
  if (_particleTimer) clearInterval(_particleTimer);
  const container = document.getElementById('menu-particles');
  if (!container) return;
  const colors = ['#fdcb6e','#fd79a8','#a29bfe','#00cec9','#ffeaa7'];
  _particleTimer = setInterval(() => {
    if (ScreenManager.current !== 'menu') return;
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.bottom = '0';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.width = (4 + Math.random() * 8) + 'px';
    p.style.height = p.style.width;
    p.style.opacity = 0.4 + Math.random() * 0.4;
    p.style.animationDuration = (2 + Math.random() * 3) + 's';
    container.appendChild(p);
    setTimeout(() => p.remove(), 5000);
  }, 600);
}
