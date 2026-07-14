// ===== App Init =====
document.addEventListener('DOMContentLoaded', () => {
  S = load();
  initLoading();
  initNav();
  initGame();
  initQR();
  initSettings();
  initInvite();
  checkReferral();
});

function initLoading() {
  const fill = document.getElementById('loading-fill');
  const txt = document.getElementById('loading-text');
  const imgs = ['assets/barsik_wave.png','assets/barsik_run.png','assets/barsik_idle.png','assets/bg_menu.png','assets/map.png','assets/chest.png','assets/item_star.png','assets/item_heart.png'];
  WORLDS.forEach(w => { imgs.push(w.bg); imgs.push(w.icon); });
  let loaded = 0;
  const total = imgs.length;

  function done() {
    fill.style.width = '100%';
    txt.textContent = 'Готово!';
    setTimeout(() => {
      const bonus = checkDaily(S);
      trackTask(S, 'visit', 1);
      show('menu');
      updateMenu(S);
      if (bonus > 0) setTimeout(() => toast(`Ежедневный бонус: +${bonus} ⭐`, 'success'), 400);
      const ret = getReturnMessage(S);
      if (ret) setTimeout(() => toast(ret, 'friend'), 800);
      save(S);
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
  document.querySelectorAll('[data-back]').forEach(b => {
    b.onclick = () => {
      const t = b.dataset.back;
      show(t);
      if (t === 'menu') updateMenu(S);
      if (t === 'map') renderMap(S);
    };
  });

  const handlers = {
    'btn-play': () => { show('difficulty'); renderDiff(); },
    'btn-city': () => { show('city'); renderCity(S); },
    'btn-collection': () => { show('collection'); renderCollection(S); },
    'btn-qr': () => {
      show('qr');
      document.getElementById('qr-intro').style.display = 'flex';
      document.getElementById('qr-result').style.display = 'none';
      document.getElementById('qr-opened').textContent = S.qrOpened;
    },
    'btn-rating': () => { show('rating'); renderRating(S); },
    'btn-profile': () => { show('profile'); renderProfile(S); },
    'btn-tasks': () => { show('tasks'); renderTasks(S); },
    'btn-invite': () => { show('invite'); renderInvite(S); },
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
  document.getElementById('btn-pause').onclick = () => { if (G && G.running) { G.pause(); document.getElementById('overlay-pause').classList.add('show'); } };
  document.getElementById('btn-resume').onclick = () => { document.getElementById('overlay-pause').classList.remove('show'); if (G) G.resume(); };
  document.getElementById('btn-restart').onclick = () => { document.getElementById('overlay-pause').classList.remove('show'); if (G) { const l = G.level, w = G.world; G.destroy(); startGame(l, w); } };
  document.getElementById('btn-quit').onclick = () => { document.getElementById('overlay-pause').classList.remove('show'); if (G) G.destroy(); show('map'); renderMap(S); };
}

function initQR() {
  document.getElementById('btn-open-chest').onclick = () => openChest(S);
  document.getElementById('chest-img').onclick = () => openChest(S);
  document.getElementById('btn-qr-done').onclick = () => {
    document.getElementById('qr-result').style.display = 'none';
    document.getElementById('qr-intro').style.display = 'flex';
    document.getElementById('qr-opened').textContent = S.qrOpened;
    updateMenu(S);
  };
}

function initSettings() {
  document.getElementById('btn-settings').onclick = () => {
    document.getElementById('set-name').value = S.name;
    show('settings');
  };
  document.getElementById('btn-close-settings').onclick = () => {
    const n = document.getElementById('set-name').value.trim();
    if (n) { S.name = n; save(S); updateMenu(S); }
    show('menu');
  };
  document.getElementById('btn-reset').onclick = () => {
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
    const inp = document.getElementById('invite-link');
    inp.select();
    document.execCommand('copy');
    toast('Ссылка скопирована!', 'success');
  };
  document.getElementById('btn-share').onclick = () => {
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
