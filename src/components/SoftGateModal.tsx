import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { t } from '@/i18n';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconMail, IconPhone } from '@/components/ui/icons';
import { formatPhoneDisplay, isPhoneComplete, phoneDigits } from '@/utils/phone';
import { logWarn } from '@/utils/logger';
import './SoftGateModal.css';

export function SoftGateModal() {
  const gate = useUIStore((s) => s.softGate);
  const closeSoftGate = useUIStore((s) => s.closeSoftGate);
  const lang = useUIStore((s) => s.lang);
  const patchPlayer = useGameStore((s) => s.patchPlayer);
  const player = useGameStore((s) => s.player);

  const [phone, setPhone] = useState(() => formatPhoneDisplay(player?.phone || ''));
  const [email, setEmail] = useState(player?.email || '');
  const [err, setErr] = useState('');

  if (!gate || !player) return null;

  const isEmail = gate === 'email';
  const title = isEmail
    ? t(lang, 'gate.email.title')
    : gate === 'phone_5levels'
      ? t(lang, 'gate.phone5.title')
      : t(lang, 'gate.phone1.title');

  const body = isEmail ? t(lang, 'gate.email.body') : t(lang, 'gate.phone.body');

  const skip = () => {
    if (isEmail) {
      patchPlayer({ emailAskedAt: new Date().toISOString() });
    } else {
      patchPlayer({ phoneAskedAt: new Date().toISOString() });
    }
    closeSoftGate();
  };

  const save = () => {
    if (isEmail) {
      const v = email.trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        setErr(t(lang, 'gate.email.err'));
        return;
      }
      patchPlayer({
        email: v,
        emailAskedAt: new Date().toISOString(),
        profileStage: v ? 'complete' : player.profileStage,
      });
      closeSoftGate();
      return;
    }

    if (!isPhoneComplete(phone)) {
      setErr(t(lang, 'gate.phone.err'));
      return;
    }
    const pretty = formatPhoneDisplay(phone);
    patchPlayer({
      phone: pretty,
      phoneAskedAt: new Date().toISOString(),
      profileStage: 'phone',
    });
    try {
      localStorage.setItem(
        'barsik_cloud_pending',
        JSON.stringify({
          id: player.id,
          nick: player.nick,
          phone: pretty,
          phoneE164: `+${phoneDigits(phone)}`,
          at: Date.now(),
        }),
      );
    } catch (e) {
      logWarn('softGate.cloudPending', e);
    }
    closeSoftGate();
  };

  return (
    <div
      className="soft-gate-overlay"
      role="dialog"
      aria-modal="true"
      onClick={skip}
    >
      <div className="soft-gate-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="soft-gate-icon">{isEmail ? <IconMail size={30} /> : <IconPhone size={30} />}</div>
        <h2>{title}</h2>
        <p className="soft-gate-body">{body}</p>

        {isEmail ? (
          <input
            type="email"
            className="soft-gate-input"
            placeholder="parent@mail.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErr('');
            }}
          />
        ) : (
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="soft-gate-input"
            placeholder="+7 777 777 77 77"
            value={phone}
            onChange={(e) => {
              setPhone(formatPhoneDisplay(e.target.value));
              setErr('');
            }}
            onFocus={() => {
              if (!phone) setPhone('+7 ');
            }}
          />
        )}

        {err && <p className="soft-gate-err">{err}</p>}

        <PlushButton variant="secondary" className="soft-gate-save" onClick={save}>
          {t(lang, 'gate.save')}
        </PlushButton>
        <button type="button" className="soft-gate-skip" onClick={skip}>
          {t(lang, 'gate.later')}
        </button>
      </div>
    </div>
  );
}
