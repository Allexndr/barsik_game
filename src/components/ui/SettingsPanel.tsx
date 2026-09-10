import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { PlushButton } from '@/components/ui/PlushButton';
import { AudioManager } from '@/audio/AudioManager';
import { IconSoundOff, IconSoundOn } from '@/components/ui/icons';
import './SettingsPanel.css';

interface SettingsPanelProps {
  onRestart?: () => void;
}

export function SettingsPanel({ onRestart }: SettingsPanelProps) {
  const showSettings = useUIStore((s) => s.showSettings);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const lang = useUIStore((s) => s.lang);
  const setLang = useUIStore((s) => s.setLang);
  const muted = useUIStore((s) => s.muted);
  const toggleMuted = useUIStore((s) => s.toggleMuted);
  const volume = useUIStore((s) => s.volume);
  const setVolume = useUIStore((s) => s.setVolume);
  const ttsEnabled = useUIStore((s) => s.ttsEnabled);
  const toggleTts = useUIStore((s) => s.toggleTts);
  const voiceGender = useUIStore((s) => s.voiceGender);
  const setVoiceGender = useUIStore((s) => s.setVoiceGender);
  const freeChatEnabled = useUIStore((s) => s.freeChatEnabled);
  const setFreeChat = useUIStore((s) => s.setFreeChat);
  const paused = useUIStore((s) => s.paused);
  const setPaused = useUIStore((s) => s.setPaused);
  const setScreen = useUIStore((s) => s.setScreen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Раньше пауза открывала эту панель сразу на управлении языком, громкостью и
  // озвучкой: ребёнок, нажавший паузу, попадал в настройки, а не к «продолжить,
  // заново, выйти». На паузе сначала показывается меню, а настройки — по запросу;
  // вне паузы (сегодня у этой панели других вызовов нет) сразу настройки, как
  // раньше.
  const [showSettingsSubview, setShowSettingsSubview] = useState(false);

  useEffect(() => {
    if (!showSettings) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const dialog = dialogRef.current;
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const focusFirst = () => {
      const initial = dialog?.querySelector<HTMLElement>('[data-dialog-initial]');
      const first = dialog?.querySelector<HTMLElement>(focusableSelector);
      (initial ?? first)?.focus();
    };
    // Откладываем на кадр, чтобы фокус выиграл у события указателя, открывшего
    // меню паузы, и у любого обработчика ввода на уровне сцены.
    const focusFrame = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPaused(false);
        setShowSettings(false);
        setShowSettingsSubview(false);
        AudioManager.stopTts();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
      restoreFocusRef.current = null;
    };
  }, [showSettings, setPaused, setShowSettings, setShowSettingsSubview]);

  if (!showSettings) return null;

  const ru = lang === 'ru';
  const showMenu = paused && !showSettingsSubview;

  const handleVolume = (v: number) => {
    setVolume(v);
    AudioManager.setVolume(v);
    if (v > 0 && muted) toggleMuted();
  };

  const handleMute = () => {
    toggleMuted();
    AudioManager.setMuted(!muted);
    if (muted) AudioManager.sfx('click');
  };

  const handleTts = () => {
    toggleTts();
    AudioManager.setTtsEnabled(!ttsEnabled);
    if (!ttsEnabled) AudioManager.tts(ru ? 'Озвучка включена' : 'Дауыс қосылды', lang);
  };

  const handleVoiceGender = (g: 'f' | 'm') => {
    if (g === voiceGender) {
      AudioManager.playVoicePreview(lang, g);
      return;
    }
    setVoiceGender(g);
    AudioManager.setVoiceGender(g);
    AudioManager.sfx('click');
    AudioManager.playVoicePreview(lang, g);
  };

  const handleResume = () => {
    setPaused(false);
    setShowSettings(false);
    setShowSettingsSubview(false);
    AudioManager.sfx('click');
  };

  const handleQuit = () => {
    setPaused(false);
    setShowSettings(false);
    setShowSettingsSubview(false);
    AudioManager.stopTts();
    setScreen('game');
  };

  return (
    <div
      className="settings-overlay"
      onClick={(e) => e.target === e.currentTarget && handleResume()}
    >
      <div
        ref={dialogRef}
        className="settings-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <button
          type="button"
          className="settings-close"
          onClick={handleResume}
          aria-label={ru
            ? (paused ? 'Закрыть меню паузы' : 'Закрыть настройки')
            : (paused ? 'Үзіліс мәзірін жабу' : 'Параметрлерді жабу')}
        >
          ×
        </button>

        <h2 className="settings-title">
          <span id="settings-title">
            {showMenu ? (ru ? 'Пауза' : 'Кідірту') : (ru ? 'Настройки' : 'Параметрлер')}
          </span>
        </h2>

        {showMenu ? (
        <div className="settings-actions">
          <PlushButton variant="primary" size="lg" onClick={handleResume} data-dialog-initial>
            {ru ? 'Продолжить' : 'Жалғастыру'}
          </PlushButton>
          {onRestart && (
            <PlushButton
              variant="ghost"
              size="md"
              onClick={() => {
                AudioManager.stopTts();
                AudioManager.stopMusic();
                onRestart();
              }}
            >
              {ru ? 'Начать уровень заново' : 'Деңгейді қайта бастау'}
            </PlushButton>
          )}
          <PlushButton
            variant="ghost"
            size="md"
            onClick={() => { AudioManager.sfx('click'); setShowSettingsSubview(true); }}
          >
            {ru ? 'Настройки' : 'Параметрлер'}
          </PlushButton>
          <PlushButton variant="ghost" size="md" onClick={handleQuit}>
            {/* Называет то место, куда действительно ведёт. `handleQuit` вызывает
                setScreen('game'), а это карта путешествия, а не меню. На телефоне
                это теперь единственный выход с уровня, так что он обязан сообщать,
                куда именно ведёт. */}
            {ru ? 'Выйти на карту' : 'Картаға шығу'}
          </PlushButton>
        </div>
        ) : (
        <>
        {/* Язык */}
        <div className="settings-row">
          <span className="settings-label" id="settings-language-label">{ru ? 'Язык' : 'Тіл'}</span>
          <div className="settings-lang" role="group" aria-labelledby="settings-language-label">
            <button
              type="button"
              className={`settings-lang-btn ${lang === 'ru' ? 'is-active' : ''}`}
              onClick={() => { setLang('ru'); AudioManager.sfx('click'); }}
              aria-pressed={lang === 'ru'}
            >Рус</button>
            <button
              type="button"
              className={`settings-lang-btn ${lang === 'kk' ? 'is-active' : ''}`}
              onClick={() => { setLang('kk'); AudioManager.sfx('click'); }}
              aria-pressed={lang === 'kk'}
            >Қаз</button>
          </div>
        </div>

        {/* Громкость */}
        <div className="settings-row">
          <span className="settings-label" id="settings-volume-label">{ru ? 'Громкость' : 'Дыбыс'}</span>
          <div className="settings-volume">
            <input
              aria-labelledby="settings-volume-label"
              aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
              className="settings-slider"
            />
            <button
              type="button"
              className="settings-mute-btn"
              onClick={handleMute}
              aria-label={ru ? 'Включить или выключить звук' : 'Дыбысты қосу немесе өшіру'}
              aria-pressed={muted}
            >
              {muted ? <IconSoundOff size={20} /> : <IconSoundOn size={20} />}
            </button>
          </div>
        </div>

        {/* Озвучка реплик */}
        <div className="settings-row">
          <span className="settings-label">{ru ? 'Озвучка текста' : 'Мәтін дауысы'}</span>
          <button
            type="button"
            className={`settings-toggle ${ttsEnabled ? 'is-on' : 'is-off'}`}
            onClick={handleTts}
            aria-label={ru ? 'Озвучка текста' : 'Мәтін дауысы'}
            aria-pressed={ttsEnabled}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        {/* Голос рассказчика — пакеты в voice/ и voice/m/ */}
        <div className="settings-row">
          <span className="settings-label" id="settings-voice-label">
            {ru ? 'Голос' : 'Дауыс'}
          </span>
          <div className="settings-lang" role="group" aria-labelledby="settings-voice-label">
            <button
              type="button"
              className={`settings-lang-btn ${voiceGender === 'f' ? 'is-active' : ''}`}
              onClick={() => handleVoiceGender('f')}
              aria-pressed={voiceGender === 'f'}
            >
              {ru ? 'Женский' : 'Әйел'}
            </button>
            <button
              type="button"
              className={`settings-lang-btn ${voiceGender === 'm' ? 'is-active' : ''}`}
              onClick={() => handleVoiceGender('m')}
              aria-pressed={voiceGender === 'm'}
            >
              {ru ? 'Мужской' : 'Ер'}
            </button>
          </div>
        </div>

        {/*
          Свободный чат в хабе.

          Стоит отдельным блоком с пояснением, а не ещё одним тумблером в ряд:
          это единственная настройка игры, которая меняет не удобство, а то,
          что ребёнок может получить от постороннего. Родитель должен понимать,
          что включает, поэтому здесь есть текст, а не только переключатель.

          По умолчанию выключено. Даже включённый режим не отменяет фильтр —
          он стоит и на отправке, и на приёме.
        */}
        <div className="settings-row settings-row-parent">
          <div className="settings-parent-text">
            <span className="settings-label">
              {ru ? 'Свободный чат в хабе' : 'Хабта еркін чат'}
            </span>
            <span className="settings-hint">
              {ru
                ? 'Настройка для родителей. Выключено — дети общаются готовыми фразами. Включено — можно писать своими словами; фильтр остаётся, но следить за перепиской придётся вам.'
                : 'Ата-аналарға арналған баптау. Өшірулі — балалар дайын сөйлемдермен сөйлеседі. Қосулы — өз сөзімен жазуға болады; сүзгі қалады, бірақ хат алмасуды өзіңіз қадағалауыңыз керек.'}
            </span>
          </div>
          <button
            type="button"
            className={`settings-toggle ${freeChatEnabled ? 'is-on' : 'is-off'}`}
            onClick={() => setFreeChat(!freeChatEnabled)}
            aria-label={ru ? 'Свободный чат в хабе' : 'Хабта еркін чат'}
            aria-pressed={freeChatEnabled}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        {/* Назад в меню паузы: на паузе настройки — вложенный экран, а не первое,
            что видит ребёнок, нажав паузу. */}
        {paused && (
          <div className="settings-actions">
            <PlushButton variant="primary" size="lg" onClick={() => setShowSettingsSubview(false)}>
              {ru ? 'Вернуться к паузе' : 'Үзіліске оралу'}
            </PlushButton>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
