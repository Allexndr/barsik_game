import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { CityScene } from '@/three/scenes/CityScene';
import { IconPaw } from '@/components/ui/icons';
import { FriendPortrait } from '@/components/widgets/FriendPortrait';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';
import { cityProgress, cityTitle } from '@/utils/cityStages';
import './meta-screen.css';
import './CityScreen.css';

/**
 * The city.
 *
 * Two things were wrong here, both of the same kind. It advertised «Твои
 * украшения» with a button to the shop — but the shop became a wardrobe, so
 * nothing on sale could ever land in that list; a child could follow that
 * button forever and the block would stay empty. And the residents were a row
 * of name chips: nine friends earned across seventeen levels, reduced to text.
 *
 * Now the block that says what comes next says something that will actually
 * come, and tapping a resident says who they are and where you met them.
 */
export function CityScreen() {
  const friends = useGameStore((s) => s.friends);
  const outfit = useGameStore((s) => s.outfit);
  const lang = useUIStore((s) => s.lang);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CityScene | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const residents = useMemo(
    () =>
      friends.map((friend) => {
        const entry = SEASON1_FRIENDS.find((c) => c.id === friend.id);
        return {
          id: friend.id,
          name: entry ? (lang === 'kk' ? entry.nameKk : entry.name) : friend.name,
          role: entry ? (lang === 'kk' ? entry.roleKk : entry.role) : '',
          blurb: entry ? (lang === 'kk' ? entry.blurbKk : entry.blurb) : '',
          levelId: entry?.levelId ?? null,
        };
      }),
    [friends, lang],
  );

  const progress = cityProgress(friends.length);
  const title = cityTitle(friends.length, lang);
  const chosen = residents.find((r) => r.id === selected) ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const city = new CityScene(canvas);
    sceneRef.current = city;

    const resize = () => city.resize(wrap.clientWidth, wrap.clientHeight);
    resize();
    city.start();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      city.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setCity(
      residents.map((r) => ({ id: r.id, name: r.name })),
      outfit,
    );
  }, [residents, outfit]);

  // Tapping a resident in the 3D view and tapping their card do the same
  // thing, so a child who found one way does not have to learn the other.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setPickHandler((id) => setSelected((cur) => (id && id !== cur ? id : null)));
    return () => scene.setPickHandler(null);
  }, []);

  useEffect(() => {
    sceneRef.current?.setHighlight(selected);
  }, [selected]);

  const toggle = useCallback(
    (id: string) => setSelected((cur) => (cur === id ? null : id)),
    [],
  );

  return (
    <div className="screen screen-city screen-meta">
      <header className="meta-screen-header city-header">
        <div>
          <h2>{lang === 'kk' ? 'Барсик қаласы' : 'Город Барсика'}</h2>
          <p className="meta-screen-sub">{title}</p>
        </div>
        <div className="city-count">
          <IconPaw size={15} />
          {friends.length}/{SEASON1_FRIENDS.length}
        </div>
      </header>

      <div className="city-3d-viewer" ref={wrapRef}>
        <canvas ref={canvasRef} className="city-canvas" />
        {residents.length > 0 && !chosen && (
          <span className="city-canvas-hint">
            {lang === 'kk' ? 'Тұрғынды басып көр' : 'Нажми на жителя'}
          </span>
        )}
        {chosen && (
          <div className="city-resident-card" role="status">
            <FriendPortrait id={chosen.id} size={44} />
            <div className="city-resident-text">
              <strong>{chosen.name}</strong>
              <span className="city-resident-role">{chosen.role}</span>
              <p>{chosen.blurb}</p>
              {chosen.levelId !== null && (
                // The level number rather than its title: the titles have no
                // Kazakh translation, and a number reads the same either way.
                <span className="city-resident-met">
                  {lang === 'kk'
                    ? `${chosen.levelId + 1}-деңгейде таныстық`
                    : `Познакомились на уровне ${chosen.levelId + 1}`}
                </span>
              )}
            </div>
            <button
              type="button"
              className="city-resident-close"
              onClick={() => setSelected(null)}
              aria-label={lang === 'kk' ? 'Жабу' : 'Закрыть'}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* What the city gains next — a promise the city actually keeps. */}
      <section className="city-next">
        {progress.next ? (
          <>
            <div className="city-next-head">
              <h3>{lang === 'kk' ? 'Келесі' : 'Дальше в городе'}</h3>
              <span className="city-next-name">{progress.next.name[lang]}</span>
            </div>
            <p className="city-next-promise">{progress.next.promise[lang]}</p>
            <div
              className="city-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.next.at}
              aria-valuenow={friends.length}
            >
              <span style={{ width: `${(friends.length / progress.next.at) * 100}%` }} />
            </div>
            <p className="city-next-togo">
              {lang === 'kk'
                ? `Тағы ${progress.toGo} дос керек`
                : `Ещё ${progress.toGo} ${friendWord(progress.toGo)}`}
            </p>
          </>
        ) : (
          <>
            <div className="city-next-head">
              <h3>{lang === 'kk' ? 'Қала дайын!' : 'Город построен!'}</h3>
            </div>
            <p className="city-next-promise">
              {lang === 'kk'
                ? 'Барлық достар үйде. Мерекені бастауға болады.'
                : 'Все друзья дома. Можно начинать праздник.'}
            </p>
          </>
        )}
      </section>

      {residents.length === 0 ? (
        // No button here: MetaScreenFooter already ends every meta screen with
        // «В Путешествие», and two identical calls to action stacked one above
        // the other is a choice a child has to think about for no reason.
        <div className="city-empty">
          <p>
            {lang === 'kk'
              ? 'Қала бос. Саяхатта бірінші досыңды тап — ол осында көшіп келеді.'
              : 'В городе пусто. Найди первого друга в Путешествии — он переедет сюда.'}
          </p>
        </div>
      ) : (
        <section className="city-section">
          <h3 className="city-section-title">
            {lang === 'kk' ? 'Тұрғындар' : 'Жители'}
          </h3>
          <div className="city-residents">
            {residents.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`city-resident ${selected === r.id ? 'is-selected' : ''}`}
                onClick={() => toggle(r.id)}
                aria-pressed={selected === r.id}
              >
                <FriendPortrait id={r.id} size={46} />
                <span className="city-resident-name">{r.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <MetaScreenFooter
        hint={
          lang === 'kk'
            ? 'Барсик Гардеробтан алған киімін киіп тұр.'
            : 'Барсик носит то, что ты купил в Гардеробе.'
        }
      />
    </div>
  );
}

function friendWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'друг';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'друга';
  return 'друзей';
}
