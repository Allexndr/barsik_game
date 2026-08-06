import { useUIStore } from '@/store/useUIStore';
import { PlushButton } from '@/components/ui/PlushButton';
import { AudioManager } from '@/audio/AudioManager';
import { IconSoundOff, IconSoundOn } from '@/components/ui/icons';
import './SettingsPanel.css';

export function SettingsPanel() {
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
  const paused = useUIStore((s) => s.paused);
  const setPaused = useUIStore((s) => s.setPaused);
  const setScreen = useUIStore((s) => s.setScreen);

  if (!showSettings) return null;

  const ru = lang === 'ru';

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

  const handleResume = () => {
    setPaused(false);
    setShowSettings(false);
    AudioManager.sfx('click');
  };

  const handleQuit = () => {
    setPaused(false);
    setShowSettings(false);
    AudioManager.stopTts();
    setScreen('game');
  };

  return (
    <div
      className="settings-overlay"
      onClick={(e) => e.target === e.currentTarget && handleResume()}
    >
      <div className="settings-card">
        <button
          className="settings-close"
          onClick={handleResume}
          aria-label={ru ? 'Закрыть настройки' : 'Параметрлерді жабу'}
        >
          ×
        </button>

        <h2 className="settings-title">
          {ru ? 'Настройки' : 'Параметрлер'}
        </h2>

        {/* Language */}
        <div className="settings-row">
          <span className="settings-label">{ru ? 'Язык' : 'Тіл'}</span>
          <div className="settings-lang">
            <button
              className={`settings-lang-btn ${lang === 'ru' ? 'is-active' : ''}`}
              onClick={() => { setLang('ru'); AudioManager.sfx('click'); }}
            >Рус</button>
            <button
              className={`settings-lang-btn ${lang === 'kk' ? 'is-active' : ''}`}
              onClick={() => { setLang('kk'); AudioManager.sfx('click'); }}
            >Қаз</button>
          </div>
        </div>

        {/* Volume */}
        <div className="settings-row">
          <span className="settings-label">{ru ? 'Громкость' : 'Дыбыс'}</span>
          <div className="settings-volume">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
              className="settings-slider"
            />
            <button
              className="settings-mute-btn"
              onClick={handleMute}
              aria-label={ru ? 'Включить или выключить звук' : 'Дыбысты қосу немесе өшіру'}
            >
              {muted ? <IconSoundOff size={20} /> : <IconSoundOn size={20} />}
            </button>
          </div>
        </div>

        {/* TTS */}
        <div className="settings-row">
          <span className="settings-label">{ru ? 'Озвучка текста' : 'Мәтін дауысы'}</span>
          <button
            className={`settings-toggle ${ttsEnabled ? 'is-on' : 'is-off'}`}
            onClick={handleTts}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        {/* Pause actions */}
        {paused && (
          <div className="settings-actions">
            <PlushButton variant="primary" size="lg" onClick={handleResume}>
              {ru ? 'Продолжить' : 'Жалғастыру'}
            </PlushButton>
            <PlushButton variant="ghost" size="md" onClick={handleQuit}>
              {/* Names the place it actually goes. `handleQuit` calls
                  setScreen('game'), which is the travel map — not a menu.
                  On a phone this is now the only way out of a level, so it
                  had better say where it leads. */}
              {ru ? 'Выйти на карту' : 'Картаға шығу'}
            </PlushButton>
          </div>
        )}
      </div>
    </div>
  );
}
