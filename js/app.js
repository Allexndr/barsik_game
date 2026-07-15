// ===== App Init =====
document.addEventListener('DOMContentLoaded', async () => {
  S = load();
  if (typeof Cloud !== 'undefined') {
    try { S = await Cloud.pull(S); save(S); } catch {}
  }
  Sound.init();
  ScreenManager.init();
  initLoading();
  initLogin();
  initNav();
  initGame();
  initQR();
  initSettings();
  initInvite();
  initMinigames();
  checkReferral();
  startMenuParticles();
});

// ===== Login =====
function initLogin() {
  const btn = document.getElementById('btn-login-start');
  const inp = document.getElementById('login-name');
  btn.onclick = () => {
    const name = inp.value.trim();
    if (!name) { inp.focus(); inp.style.borderColor = '#e74c3c'; Sound.hit(); return; }
    Sound.levelup();
    S.name = name;
    S.hasLoggedIn = true;
    save(S);
    ScreenManager.show('menu');
    updateMenu(S);
    const bonus = checkDaily(S);
    trackTask(S, 'visit', 1);
    if (bonus > 0) { setTimeout(() => { toast(`Ежедневный бонус: +${bonus} ⭐`, 'success'); Sound.daily(); }, 400); }
    const ret = getReturnMessage(S);
    if (ret) setTimeout(() => toast(ret, 'friend'), 800);
    save(S);
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
}

function initLoading() {
  const fill = document.getElementById('loading-fill');
  const txt = document.getElementById('loading-text');
  const tip = document.getElementById('loading-tip');
  const tips = [
    'Беги, прыгай и собирай звёзды!',
    'Меняй полосы свайпами вверх/вниз.',
    'Нажми, чтобы прыгнуть через препятствие.',
    'Собирай друзей на разных уровнях.',
    'Украшай город и получай бонусы!'
  ];
  let tipIdx = 0;
  if (tip) {
    tip.textContent = tips[0];
    setInterval(() => { tipIdx = (tipIdx + 1) % tips.length; tip.textContent = tips[tipIdx]; }, 2200);
  }
  const imgs = ['assets/barsik_run.png','assets/barsik_idle.png','assets/barsik_jump.png','assets/barsik_fall.png','assets/barsik_celebrate.png','assets/barsik_wave.png'];
  WORLDS.forEach(w => { imgs.push(w.icon); });
  const icons = ['assets/items/star.png','assets/items/heart.png','assets/items/shield.png','assets/items/magnet.png','assets/items/speed.png','assets/items/chest.png','assets/icons/items/question.svg','assets/icons/items/check.svg','assets/icons/items/lock.svg','assets/icons/items/clipboard.svg'];
  FRIENDS.forEach(f => icons.push(f.icon));
  COSTUMES.forEach(c => icons.push(c.icon));
  CITY_OBJS.forEach(b => icons.push(b.icon));
  imgs.push(...icons);
  let loaded = 0;
  const total = imgs.length;

  function done() {
    fill.style.width = '100%';
    txt.textContent = 'Готово!';
    setTimeout(() => {
      if (S.hasLoggedIn) {
        const bonus = checkDaily(S);
        trackTask(S, 'visit', 1);
        ScreenManager.show('menu');
        updateMenu(S);
        if (bonus > 0) setTimeout(() => { toast(`Ежедневный бонус: +${bonus} ⭐`, 'success'); Sound.daily(); }, 400);
        const ret = getReturnMessage(S);
        if (ret) setTimeout(() => toast(ret, 'friend'), 800);
        save(S);
      } else {
        ScreenManager.show('login');
        setTimeout(() => document.getElementById('login-name').focus(), 500);
      }
    }, 400);
  }

  imgs.forEach(src => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loaded++;
      const pct = Math.round((loaded / total) * 100);
      fill.style.width = pct + '%';
      txt.textContent = 'Загрузка... ' + pct + '%';
      if (loaded >= total) done();
    };
    img.src = src;
  });
  setTimeout(() => { if (loaded < total) done(); }, 5000);
}

function initNav() {
  const handlers = {
    'btn-play': () => { Sound.click(); show('difficulty'); renderDiff(); },
    'btn-city': () => { Sound.click(); show('city'); renderCity(S); },
    'btn-collection': () => { Sound.click(); show('collection'); renderCollection(S); },
    'btn-qr': () => {
      Sound.click(); show('qr');
      document.getElementById('qr-intro').style.display = 'flex';
      document.getElementById('qr-result').style.display = 'none';
      document.getElementById('qr-opened').textContent = S.qrOpened;
    },
    'btn-rating': () => { Sound.click(); show('rating'); renderRating(S); },
    'btn-profile': () => { Sound.click(); show('profile'); renderProfile(S); },
    'btn-tasks': () => { Sound.click(); show('tasks'); renderTasks(S); },
    'btn-minigames': () => { Sound.click(); show('minigames'); renderMinigamesList(); },
    'btn-invite': () => { Sound.click(); show('invite'); renderInvite(S); },
  };
  Object.entries(handlers).forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  });

  document.querySelectorAll('.rtab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.rtab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderRating(S);
    };
  });
}

function initGame() {
  document.getElementById('btn-pause').onclick = () => { if (G && G.running) { G.pause(); Sound.stopMusic(); document.getElementById('overlay-pause').classList.add('show'); Sound.tap(); } };
  document.getElementById('btn-resume').onclick = () => { document.getElementById('overlay-pause').classList.remove('show'); if (G) G.resume(); Sound.startMusic(); Sound.tap(); };
  document.getElementById('btn-restart').onclick = () => { document.getElementById('overlay-pause').classList.remove('show'); Sound.stopMusic(); if (G) { const l = G.level, w = G.world; G.destroy(); startGame(l, w); } };
  document.getElementById('btn-quit').onclick = () => { document.getElementById('overlay-pause').classList.remove('show'); Sound.stopMusic(); if (G) G.destroy(); Sound.tap(); show('map'); renderMap(S); };
}

function initQR() {
  document.getElementById('btn-open-chest').onclick = () => { Sound.tap(); openChest(S); };
  document.getElementById('chest-img').onclick = () => { Sound.tap(); openChest(S); };
  document.getElementById('btn-qr-done').onclick = () => {
    Sound.tap();
    document.getElementById('qr-result').style.display = 'none';
    document.getElementById('qr-intro').style.display = 'flex';
    document.getElementById('qr-opened').textContent = S.qrOpened;
    updateMenu(S);
  };
}

function initSettings() {
  document.getElementById('btn-settings').onclick = () => {
    Sound.tap();
    document.getElementById('set-name').value = S.name;
    document.getElementById('set-sound').checked = S.sound;
    show('settings');
  };
  document.getElementById('btn-close-settings').onclick = () => {
    Sound.tap();
    const n = document.getElementById('set-name').value.trim();
    if (n) { S.name = n; save(S); updateMenu(S); }
    S.sound = document.getElementById('set-sound').checked;
    Sound.enabled = S.sound;
    save(S);
    show('menu');
  };
  document.getElementById('btn-reset').onclick = () => {
    Sound.hit();
    if (confirm('Сбросить весь прогресс?')) {
      reset();
      S = load();
      show('menu');
      updateMenu(S);
      toast('Прогресс сброшен');
    }
  };
}

function initInvite() {
  document.getElementById('btn-copy-link').onclick = () => {
    Sound.tap();
    const inp = document.getElementById('invite-link');
    inp.select();
    document.execCommand('copy');
    toast('Ссылка скопирована!', 'success');
  };
  document.getElementById('btn-share').onclick = () => {
    Sound.tap();
    const link = document.getElementById('invite-link').value;
    if (navigator.share) {
      navigator.share({ title: 'Путешествие Барсика', text: 'Играй со мной в Путешествие Барсика!', url: link });
    } else {
      const inp = document.getElementById('invite-link');
      inp.select();
      document.execCommand('copy');
      toast('Ссылка скопирована! Поделись с друзьями!', 'success');
    }
  };
}

function checkReferral() {
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (ref && !S.referredBy) {
    S.referredBy = ref;
    S.invited = (S.invited || 0) + 1;
    S.inviteBonus = (S.inviteBonus || 0) + 10;
    S.stars += 10;
    save(S);
    setTimeout(() => toast(`${ref} пригласил тебя! +10 ⭐`, 'success'), 1200);
  }
}
