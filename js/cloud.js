// ===== Cloud sync (Supabase) =====
// Uses only the public anon key. Never put service-role / DB passwords here.
const Cloud = {
  url: 'https://vsuqaatpzyatzhmmdmug.supabase.co',
  anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdXFhYXRwenlhdHpobW1kbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODYwNDUsImV4cCI6MjA5OTY2MjA0NX0.fA7_lyCIPUppg_DmgMuwKHaFR93jMLXD7T7tEfWsceo',
  enabled: true,
  _timer: null,
  _playerKey: null,

  headers() {
    return {
      apikey: this.anon,
      Authorization: 'Bearer ' + this.anon,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    };
  },

  playerKey(s) {
    if (this._playerKey) return this._playerKey;
    let k = null;
    try { k = localStorage.getItem('barsik_player_key'); } catch {}
    if (!k) {
      k = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem('barsik_player_key', k); } catch {}
    }
    this._playerKey = k;
    return k;
  },

  // Debounced push so we don't spam on every star collect.
  schedulePush(s) {
    if (!this.enabled) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.push(s), 900);
  },

  async push(s) {
    if (!this.enabled || !s) return;
    try {
      // Rows are readable with the public anon key — never sync personal data.
      const { phone, ...safe } = s;
      const body = [{
        player_key: this.playerKey(s),
        name: (typeof sanitizeName === 'function' ? sanitizeName(s.name) : s.name) || 'Игрок',
        data: safe,
        updated_at: new Date().toISOString(),
      }];
      await fetch(this.url + '/rest/v1/barsik_saves', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
    } catch (e) { /* offline-friendly */ }
  },

  async pull(s) {
    if (!this.enabled) return s;
    try {
      const key = this.playerKey(s);
      const r = await fetch(
        this.url + '/rest/v1/barsik_saves?player_key=eq.' + encodeURIComponent(key) + '&select=data,updated_at',
        { headers: this.headers() }
      );
      if (!r.ok) return s;
      const rows = await r.json();
      if (!rows || !rows.length) return s;
      const remote = rows[0].data;
      if (!remote || typeof remote !== 'object') return s;
      delete remote.phone;
      // Prefer the richer progress (more completed levels / stars).
      const localDone = (s.completed && s.completed.length) || 0;
      const remoteDone = (remote.completed && remote.completed.length) || 0;
      const localStars = s.totalStars || 0;
      const remoteStars = remote.totalStars || 0;
      if (remoteDone > localDone || (remoteDone === localDone && remoteStars > localStars)) {
        const name = (typeof sanitizeName === 'function' ? sanitizeName(remote.name) : remote.name) || s.name;
        return Object.assign(defaultState(), remote, { name, phone: s.phone });
      }
    } catch (e) { /* keep local */ }
    return s;
  },

  async leaderboard(limit) {
    try {
      const r = await fetch(
        this.url + '/rest/v1/barsik_leaderboard?select=name,stars,total_stars,levels,friends&limit=' + (limit || 20),
        { headers: this.headers() }
      );
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  },
};
