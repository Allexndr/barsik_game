import { useUIStore } from '@/store/useUIStore';
import { t } from '@/i18n';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconMap } from '@/components/ui/icons';
import './MetaScreenFooter.css';

interface Props {
  hint?: string;
}

/** Shared bottom CTA — every meta screen routes back to travel. */
export function MetaScreenFooter({ hint }: Props) {
  const lang = useUIStore((s) => s.lang);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <footer className="meta-screen-footer">
      {hint ? <p className="meta-screen-footer-hint">{hint}</p> : null}
      <PlushButton
        variant="primary"
        size="lg"
        icon={<IconMap size={20} />}
        onClick={() => setActiveTab('travel')}
      >
        {t(lang, 'meta.toTravel')}
      </PlushButton>
    </footer>
  );
}
