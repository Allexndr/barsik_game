// ===== Screen Manager =====
// Handles screen transitions with fade/slide animations

const ScreenManager = {
  current: 'loading',
  transitioning: false,

  show(id) {
    if (id === this.current) return;
    // Don't drop navigations during transition — finish instantly then show
    if (this.transitioning) {
      this.showInstant(id);
      return;
    }
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
        if (t === 'menu' && typeof enterTown === 'function' && S && S.hasLoggedIn) {
          // From city back goes to old menu intentionally; from others → town
          if (this.current === 'city') {
            this.show('menu');
            updateMenu(S);
            return;
          }
          enterTown();
          return;
        }
        this.show(t);
        if (t === 'menu') updateMenu(S);
        if (t === 'map') renderMap(S);
        if (t === 'collection') renderCollection(S);
      };
    });

    // Bottom nav buttons
    const navHandlers = {
      menu: () => {
        if (window.Hub3D) window.Hub3D.stop();
        if (window.Episode3D) window.Episode3D.unmount();
        if (window.Level3D && window.Level3D !== window.Episode3D) window.Level3D.unmount();
        // Home = Barsik Town
        if (typeof enterTown === 'function' && S && S.hasLoggedIn) {
          enterTown();
        } else {
          updateMenu(S);
        }
      },
      map: () => {
        if (window.Hub3D) window.Hub3D.stop();
        renderMap(S);
      },
      collection: () => { renderCollection(S); },
      tasks: () => { renderTasks(S); },
      profile: () => { renderProfile(S); },
    };
    document.querySelectorAll('[data-nav]').forEach(b => {
      b.onclick = () => {
        Sound.click();
        const t = b.dataset.nav;
        if (t === 'menu' && typeof enterTown === 'function' && S && S.hasLoggedIn) {
          enterTown();
          return;
        }
        this.show(t);
        if (navHandlers[t]) navHandlers[t]();
      };
    });
  }
};

// Keep backward compat
function show(id) { ScreenManager.show(id); }
