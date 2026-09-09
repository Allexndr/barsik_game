import { useMemo, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { t } from '@/i18n';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconMail, IconPhone } from '@/components/ui/icons';
import { formatPhoneDisplay, isPhoneComplete, phoneDigits } from '@/utils/phone';
import './SoftGateModal.css';

/**
 * A form asking for a child's phone/email needs an adult on the other side
 * of it, not just a skippable dialog a five-year-old can tap through same
 * as any other prompt. A one-off arithmetic check is the standard shape for
 * this — trivial for an adult, a real obstacle for someone who can't yet
 * add two single-digit numbers. Regenerated per gate open via `useMemo`
 * keyed on `gate`, so skipping and re-triggering doesn't reuse the answer.
 */
function useParentGateQuestion(gate: string | null) {
  return useMemo(() => {
    const a = 2 + Math.floor(Math.random() * 6); // 2..7
    const b = 2 + Math.floor(Math.random() * 6); // 2..7
    const correct = a + b;
    const distractors = new Set<number>();
    while (distractors.size < 2) {
      const d = correct + (Math.floor(Math.random() * 5) - 2 || 1);
      if (d !== correct && d > 0) distractors.add(d);
    }
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
    return { a, b, correct, options };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);
}

export function SoftGateModal() {
  const gate = useUIStore((s) => s.softGate);
  const closeSoftGate = useUIStore((s) => s.closeSoftGate);
  const lang = useUIStore((s) => s.lang);
  const patchPlayer = useGameStore((s) => s.patchPlayer);
  const player = useGameStore((s) => s.player);

  const [phone, setPhone] = useState(() => formatPhoneDisplay(player?.phone || ''));
  const [email, setEmail] = useState(player?.email || '');
  const [err, setErr] = useState('');
  const [parentVerified, setParentVerified] = useState(false);
  const [gateWrong, setGateWrong] = useState(false);
  const question = useParentGateQuestion(gate);

  if (!gate || !player) return null;

  const isEmail = gate === 'email';
  const title = isEmail
    ? t(lang, 'gate.email.title')
    : gate === 'phone_5levels'
      ? t(lang, 'gate.phone5.title')
      : t(lang, 'gate.phone1.title');

  const body = isEmail ? t(lang, 'gate.email.body') : t(lang, 'gate.phone.body');

  const resetGateState = () => {
    setParentVerified(false);
    setGateWrong(false);
  };

  const skip = () => {
    if (isEmail) {
      patchPlayer({ emailAskedAt: new Date().toISOString() });
    } else {
      patchPlayer({ phoneAskedAt: new Date().toISOString() });
    }
    resetGateState();
    closeSoftGate();
  };

  const answerGate = (value: number) => {
    if (value === question.correct) {
      setGateWrong(false);
      setParentVerified(true);
    } else {
      setGateWrong(true);
    }
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
      resetGateState();
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
    } catch {
      /* ignore */
    }
    resetGateState();
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
        {parentVerified ? (
          <>
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
          </>
        ) : (
          <>
            {/* Parental gate: a form asking for a child's contact details
                needs an adult answering it, not just whoever tapped
                through the level-5 popup. Plain arithmetic — trivial for
                an adult, a real obstacle for a pre-reading child. */}
            <div className="soft-gate-icon">{isEmail ? <IconMail size={30} /> : <IconPhone size={30} />}</div>
            <h2>{lang === 'kk' ? 'Бұл ересектерге арналған' : 'Это для взрослых'}</h2>
            <p className="soft-gate-body">
              {lang === 'kk'
                ? `Жалғастыру үшін есепті шығарыңыз: ${question.a} + ${question.b} = ?`
                : `Чтобы продолжить, решите пример: ${question.a} + ${question.b} = ?`}
            </p>
            <div className="soft-gate-options">
              {question.options.map((opt) => (
                <PlushButton
                  key={opt}
                  variant="secondary"
                  className="soft-gate-option"
                  onClick={() => answerGate(opt)}
                >
                  {opt}
                </PlushButton>
              ))}
            </div>
            {gateWrong && (
              <p className="soft-gate-err">
                {lang === 'kk' ? 'Дұрыс емес, қайта көріңіз.' : 'Не то, попробуйте ещё раз.'}
              </p>
            )}
          </>
        )}

        <button type="button" className="soft-gate-skip" onClick={skip}>
          {t(lang, 'gate.later')}
        </button>
      </div>
    </div>
  );
}
