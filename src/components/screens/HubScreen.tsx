import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { ArbatScene, type HubHud } from '@/three/scenes/hub/ArbatScene';
import { FREE_TEXT_MAX, type HubPose } from '@/net/hub';
import {
  CHAT_EMOJI, CHAT_GROUP_LABEL, CHAT_PHRASES, CHAT_COOLDOWN_MS, type ChatGroup,
} from '@/utils/safeChat';
import { checkText, moderationMessage } from '@/utils/moderation';
import './HubScreen.css';

/**
 * Общий хаб.
 *
 * Отличается от экрана уровня тем, что здесь нечего проходить: ни цели, ни
 * прогресса, ни проигрыша. Весь интерфейс — про других детей: сколько их
 * сейчас рядом, чем им ответить и как помахать.
 *
 * Чат по умолчанию фразовый. Свободный ввод появляется здесь, только если
 * родитель включил его в настройках, и даже тогда каждая строка проходит
 * `checkText` — и у отправителя, и заново у получателя.
 */

const EMOTES: Array<{ pose: HubPose; glyph: string; ru: string; kk: string }> = [
  { pose: 'wave', glyph: '👋', ru: 'Привет', kk: 'Сәлем' },
  { pose: 'dance', glyph: '💃', ru: 'Танец', kk: 'Би' },
  { pose: 'cheer', glyph: '🎉', ru: 'Ура', kk: 'Ура' },
  { pose: 'sit', glyph: '🪑', ru: 'Сесть', kk: 'Отыру' },
  { pose: 'point', glyph: '👉', ru: 'Туда', kk: 'Ана жаққа' },
];

export function HubScreen() {
  const lang = useUIStore((s) => s.lang);
  const setScreen = useUIStore((s) => s.setScreen);
  const freeChatEnabled = useUIStore((s) => s.freeChatEnabled);
  const player = useGameStore((s) => s.player);
  const ru = lang !== 'kk';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ArbatScene | null>(null);
  const lastSaidRef = useRef(0);

  const [hud, setHud] = useState<HubHud | null>(null);
  const [group, setGroup] = useState<ChatGroup>('hello');
  const [draft, setDraft] = useState('');
  const [warn, setWarn] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new ArbatScene(canvas);
    sceneRef.current = scene;
    void scene.init(player?.nick ?? '', lang, setHud);
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
    // Пересоздаём сцену при смене языка: реплики соседей рисуются в текстуру
    // при получении, и на лету их не перерисовать.
  }, [lang, player?.nick]);

  const phrases = useMemo(() => CHAT_PHRASES.filter((p) => p.group === group), [group]);

  const cooled = useCallback(() => {
    const now = Date.now();
    if (now - lastSaidRef.current < CHAT_COOLDOWN_MS) return false;
    lastSaidRef.current = now;
    return true;
  }, []);

  const say = (id: number) => {
    if (!cooled()) return;
    sceneRef.current?.say(id);
  };

  const sendFree = () => {
    const text = draft.trim();
    if (!text) return;
    const verdict = checkText(text, { minLength: 1, maxLength: FREE_TEXT_MAX, allowPunctuation: true });
    if (!verdict.ok) {
      setWarn(moderationMessage(verdict.reason, lang));
      return;
    }
    if (!cooled()) return;
    setWarn(null);
    setDraft('');
    sceneRef.current?.sayText(verdict.text);
  };

  const online = hud?.online ?? 1;
  const status = hud?.status ?? 'connecting';

  return (
    <div className="screen screen-hub">
      <canvas ref={canvasRef} className="hub-canvas" />

      <div className="hub-top">
        <button className="hub-exit" onClick={() => setScreen('game')}>
          ← {ru ? 'На карту' : 'Картаға'}
        </button>
        <div className="hub-place">
          <b>{ru ? hud?.locationRu ?? 'Арбат' : hud?.locationKk ?? 'Арбат'}</b>
          <span className={`hub-online is-${status}`}>
            {status === 'online'
              ? `${online} ${ru ? 'здесь' : 'осында'}`
              : status === 'connecting'
                ? (ru ? 'подключаемся…' : 'қосылудамыз…')
                : (ru ? 'играешь один' : 'жалғыз ойнап жатырсың')}
          </span>
        </div>
      </div>

      <div className="hub-emotes">
        {EMOTES.map((e) => (
          <button
            key={e.pose}
            className="hub-emote"
            title={ru ? e.ru : e.kk}
            onClick={() => sceneRef.current?.emote(e.pose)}
          >
            <span>{e.glyph}</span>
          </button>
        ))}
      </div>

      <div className="hub-chat">
        <div className="hub-groups">
          {(Object.keys(CHAT_GROUP_LABEL) as ChatGroup[]).map((g) => (
            <button
              key={g}
              className={`hub-group ${g === group ? 'is-on' : ''}`}
              onClick={() => setGroup(g)}
            >
              {ru ? CHAT_GROUP_LABEL[g].ru : CHAT_GROUP_LABEL[g].kk}
            </button>
          ))}
        </div>

        <div className="hub-phrases">
          {phrases.map((p) => (
            <button key={p.id} className="hub-phrase" onClick={() => say(p.id)}>
              {ru ? p.ru : p.kk}
            </button>
          ))}
        </div>

        <div className="hub-emoji">
          {CHAT_EMOJI.map((e) => (
            <button key={e.id} className="hub-emoji-btn" onClick={() => say(e.id)}>
              {e.glyph}
            </button>
          ))}
        </div>

        {freeChatEnabled && (
          <div className="hub-free">
            <input
              value={draft}
              maxLength={FREE_TEXT_MAX}
              placeholder={ru ? 'Напиши сообщение…' : 'Хабарлама жаз…'}
              onChange={(e) => { setDraft(e.target.value); setWarn(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') sendFree(); }}
            />
            <button onClick={sendFree}>{ru ? 'Сказать' : 'Айту'}</button>
          </div>
        )}
        {warn && <p className="hub-warn">{warn}</p>}
      </div>
    </div>
  );
}
