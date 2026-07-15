// ===== Screen Manager =====
// Handles screen transitions with fade/slide animations

const ScreenManager = {
  current: 'loading',
  transitioning: false,

  show(id) {
    if (this.transitioning || id === this.current) return;
    this.transitioning = true;

    const prev = document.getElementById('screen-' + this.current);
    const next = document.getElementById('screen-' + id);

    if (prev) prev.classList.add('screen-exit');
    
    setTimeout(() => {
      if (prev) { prev.classList.remove('active', 'screen-exit'); }
      if (next) {
        next.classList.add('active', 'screen-enter');
        setTimeout(() => next.classList.remove('screen-enter'), 400);
      }
      this.current = id;
      this.transitioning = false;
    }, 250);
  },

  showInstant(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
    this.current = id;
  },

  init() {
    // Back buttons
    document.querySelectorAll('[data-back]').forEach(b => {
      b.onclick = () => {
        Sound.tap();
        const t = b.dataset.back;
        this.show(t);
        if (t === 'menu') updateMenu(S);
        if (t === 'map') renderMap(S);
        if (t === 'collection') renderCollection(S);
      };
    });

    // Bottom nav buttons
    const navHandlers = {
      menu: () => { updateMenu(S); },
      map: () => { renderMap(S); },
      collection: () => { renderCollection(S); },
      tasks: () => { renderTasks(S); },
      profile: () => { renderProfile(S); },
    };
    document.querySelectorAll('[data-nav]').forEach(b => {
      b.onclick = () => {
        Sound.click();
        const t = b.dataset.nav;
        this.show(t);
        if (navHandlers[t]) navHandlers[t]();
      };
    });
  }
};

// Keep backward compat
function show(id) { ScreenManager.show(id); }
