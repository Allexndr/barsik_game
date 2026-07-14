// ===== UI Screens =====
let S = null;
let curDiff = 'easy';
let curWorld = null;

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
}

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
}

function renderDiff() {
  const list = document.getElementById('diff-list');
  list.innerHTML = '';
  DIFFS.forEach(d => {
    const c = document.createElement('div');
    c.className = 'diff-card' + (curDiff === d.id ? ' selected' : '');
    c.innerHTML = `<div class="diff-emoji">${d.emoji}</div><h3>${d.name} приключение</h3><p>${d.desc}</p>`;
    c.onclick = () => {
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
  WORLDS.forEach(w => {
    const first = w.levels[0];
    const unlocked = s.unlocked.includes(first);
    const doneCnt = w.levels.filter(l => s.completed.includes(l)).length;
    const allDone = doneCnt === w.levels.length;
    const isCur = unlocked && !allDone;
    const p = document.createElement('div');
    p.className = 'map-pin' + (!unlocked ? ' locked' : '') + (allDone ? ' done' : '') + (isCur ? ' current' : '');
    p.style.left = w.pos.x + '%';
    p.style.top = w.pos.y + '%';
    p.innerHTML = `<img class="map-pin-img" src="${w.icon}" alt="${w.name}">${doneCnt>0?`<div class="map-pin-badge">${doneCnt}/${w.levels.length}</div>`:''}<div class="map-pin-label">${w.name}</div>`;
    if (unlocked) p.onclick = () => { curWorld = w; show('levels'); renderLevels(s, w); };
    pins.appendChild(p);
  });
}

function renderLevels(s, w) {
  document.getElementById('levels-title').textContent = w.emoji + ' ' + w.name;
  const g = document.getElementById('levels-grid');
  g.innerHTML = '';
  w.levels.forEach(lv => {
    const open = s.unlocked.includes(lv);
    const done = s.completed.includes(lv);
    const fr = friendAtLevel(lv);
    const t = document.createElement('div');
    t.className = 'level-tile ' + (!open ? 'locked' : done ? 'done' : 'open');
    t.innerHTML = `${lv}${done?'<div class="check">✅</div>':''}${fr&&s.friends.includes(fr.id)?`<div class="friend-mark">${fr.emoji}</div>`:''}`;
    if (open) t.onclick = () => startGame(lv, w);
    g.appendChild(t);
  });
}

function renderCity(s) {
  const o = document.getElementById('city-objects');
  o.innerHTML = '';
  CITY_OBJS.forEach(b => {
    if (s.friends.length >= b.thr) {
      const e = document.createElement('div');
      e.className = 'city-obj';
      e.textContent = b.emoji;
      o.appendChild(e);
    }
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
    c.innerHTML = `<div class="coll-emoji">${has ? f.emoji : '❓'}</div><div class="coll-name">${has ? f.name : '???'}</div><div class="coll-rarity ${f.rarity}">${f.rarity}</div>`;
    if (has) c.onclick = () => toast(f.desc, 'friend');
    g.appendChild(c);
  });
}

function renderRating(s) {
  const list = document.getElementById('rating-list');
  list.innerHTML = '';
  const data = [
    {n:'Аня',s:850,a:'🦊'},{n:'Коля',s:720,a:'🐼'},
    {n:s.name,s:s.stars,a:'🐱',me:true},
    {n:'Лиза',s:480,a:'🦄'},{n:'Макс',s:350,a:'🐯'},
    {n:'Соня',s:280,a:'🐰'},{n:'Артём',s:200,a:'🦁'},
  ].sort((a,b) => b.s - a.s);
  const medals = ['🥇','🥈','🥉'];
  data.forEach((d, i) => {
    const r = document.createElement('div');
    r.className = 'rate-row' + (d.me ? ' me' : '');
    r.innerHTML = `<div class="rate-pos">${medals[i]||(i+1)}</div><div class="rate-av">${d.a}</div><div><div class="rate-name">${d.n}</div><div class="rate-score">⭐ ${d.s}</div></div>`;
    list.appendChild(r);
  });
}

function openChest(s) {
  document.getElementById('qr-intro').style.display = 'none';
  const res = document.getElementById('qr-result');
  res.style.display = 'flex';
  const rw = QR_REWARDS[Math.floor(Math.random() * QR_REWARDS.length)];
  document.getElementById('qr-reward-icon').textContent = rw.icon;
  document.getElementById('qr-reward-title').textContent = rw.title;
  document.getElementById('qr-reward-desc').textContent = rw.desc;
  s.qrOpened++;
  trackTask(s, 'qr', 1);
  if (rw.type === 'stars') s.stars += 50;
  else if (rw.type === 'friend') {
    const left = FRIENDS.filter(f => !s.friends.includes(f.id));
    if (left.length) {
      const nf = left[Math.floor(Math.random() * left.length)];
      s.friends.push(nf.id);
      document.getElementById('qr-reward-desc').textContent = `${nf.name} ${nf.emoji} присоединился!`;
      trackTask(s, 'friend', 1);
    } else {
      s.stars += 100;
      document.getElementById('qr-reward-desc').textContent = 'Все друзья найдены! +100⭐';
    }
  } else if (rw.type === 'booster') {
    s.boosters.shield = (s.boosters.shield||0) + 1;
    s.boosters.magnet = (s.boosters.magnet||0) + 1;
  } else if (rw.type === 'costume') {
    const left = COSTUMES.filter(c => !s.ownedCostumes.includes(c.id) && c.price > 0);
    if (left.length) {
      const nc = left[Math.floor(Math.random() * left.length)];
      s.ownedCostumes.push(nc.id);
      document.getElementById('qr-reward-desc').textContent = `Костюм: ${nc.name} ${nc.emoji}!`;
    } else { s.stars += 50; }
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
      <div class="shop-emoji">${c.emoji}</div><div class="shop-name">${c.name}</div>
      <div class="shop-price">${owned?(eq?'Надет':'Есть'):'⭐'+c.price}</div></div>`;
  });

  let emotesHtml = '';
  EMOTES.forEach(e => {
    const owned = s.ownedEmotes.includes(e.id);
    const eq = s.emote === e.id;
    emotesHtml += `<div class="shop-item ${owned?'':'locked'} ${eq?'equipped':''}" data-shop="emote" data-id="${e.id}">
      <div class="shop-emoji">${e.emoji}</div><div class="shop-name">${e.name}</div>
      <div class="shop-price">${owned?(eq?'Активна':'Есть'):'⭐'+e.price}</div></div>`;
  });

  let boostersHtml = '';
  BOOSTERS.forEach(b => {
    const cnt = s.boosters[b.id] || 0;
    boostersHtml += `<div class="shop-item"><div class="shop-emoji">${b.emoji}</div><div class="shop-name">${b.name}</div><div class="shop-price">${cnt} шт.</div></div>`;
  });

  let prizesHtml = '';
  PRIZES.forEach(p => {
    const earned = done >= p.lvl;
    prizesHtml += `<div class="prize-row ${earned?'earned':'locked'}"><span class="prize-emoji">${p.emoji}</span><span class="prize-text">Ур. ${p.lvl}: ${p.name}</span><span>${earned?'✅':'🔒'}</span></div>`;
  });

  c.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">${costume.emoji}</div>
      <div class="profile-info"><div class="profile-name">${s.name}</div><div class="profile-sub">Костюм: ${costume.name}</div></div>
    </div>
    <div class="profile-stats">
      <div class="ps-card"><div class="ps-val">${s.stars}</div><div class="ps-lbl">⭐ Звёзд</div></div>
      <div class="ps-card"><div class="ps-val">${done}</div><div class="ps-lbl">🎮 Уровней</div></div>
      <div class="ps-card"><div class="ps-val">${s.friends.length}</div><div class="ps-lbl">🐱 Друзей</div></div>
      <div class="ps-card"><div class="ps-val">${s.dailyStreak}</div><div class="ps-lbl">🔥 Серия</div></div>
    </div>
    <div class="profile-section"><h3>🎭 Костюмы</h3><div class="shop-grid">${costumesHtml}</div></div>
    <div class="profile-section"><h3>😎 Эмоции</h3><div class="shop-grid">${emotesHtml}</div></div>
    <div class="profile-section"><h3>⚡ Бустеры</h3><div class="shop-grid">${boostersHtml}</div></div>
    <div class="profile-section"><h3>🎁 Реальные призы</h3><div class="prize-list">${prizesHtml}</div></div>
  `;

  c.querySelectorAll('[data-shop]').forEach(el => {
    el.onclick = () => {
      const shop = el.dataset.shop, id = el.dataset.id;
      if (shop === 'costume') {
        if (S.ownedCostumes.includes(id)) {
          S.costume = id; save(S); renderProfile(S); toast('Костюм надет!');
        } else {
          const co = COSTUMES.find(x=>x.id===id);
          if (S.stars >= co.price) { S.stars -= co.price; S.ownedCostumes.push(id); S.costume = id; save(S); renderProfile(S); toast('Куплен: '+co.name, 'success'); }
          else toast('Не хватает звёзд!');
        }
      } else if (shop === 'emote') {
        if (S.ownedEmotes.includes(id)) {
          S.emote = id; save(S); renderProfile(S); toast('Эмоция активна!');
        } else {
          const em = EMOTES.find(x=>x.id===id);
          if (S.stars >= em.price) { S.stars -= em.price; S.ownedEmotes.push(id); S.emote = id; save(S); renderProfile(S); toast('Куплена: '+em.name, 'success'); }
          else toast('Не хватает звёзд!');
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
  TASKS.forEach(t => {
    const prog = s.tasksDone[t.id] || 0;
    const done = prog >= t.target;
    const claimed = s.tasksDone[t.id + '_claimed'];
    const card = document.createElement('div');
    card.className = 'task-card' + (done && !claimed ? ' ready' : '') + (claimed ? ' claimed' : '');
    card.innerHTML = `
      <div class="task-icon">${done?'✅':'📋'}</div>
      <div class="task-info"><div class="task-desc">${t.desc}</div>
      <div class="task-progress"><div class="task-bar"><div class="task-bar-fill" style="width:${Math.min(100,(prog/t.target)*100)}%"></div></div>
      <span class="task-count">${prog}/${t.target}</span></div></div>
      <div class="task-reward">${claimed?'<span style="opacity:0.4">⭐'+t.reward+'</span>':`<button class="btn-reward ${done?'':'disabled'}" data-task="${t.id}">⭐ ${t.reward}</button>`}</div>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll('.btn-reward').forEach(b => {
    b.onclick = () => {
      if (b.classList.contains('disabled')) return;
      const ok = claimTask(S, b.dataset.task);
      if (ok) { toast('+' + TASKS.find(t=>t.id===b.dataset.task).reward + ' ⭐', 'success'); renderTasks(S); updateMenu(S); }
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
