import { useUIStore } from '@/store/useUIStore';
import { t } from '@/i18n';
import './RewardsBar.css';

export function RewardsBar() {
  const lang = useUIStore((s) => s.lang);

  const rewards = [
    { milestone: 20, itemKey: 'reward.stickers' as const, claimed: false },
    { milestone: 40, itemKey: 'reward.mug' as const, claimed: false },
    { milestone: 60, itemKey: 'reward.shirt' as const, claimed: false },
    { milestone: 80, itemKey: 'reward.backpack' as const, claimed: false },
    { milestone: 100, itemKey: 'reward.grand' as const, claimed: false },
  ];

  return (
    <div className="rewards-bar">
      <div className="rewards-header">{t(lang, 'reward.title')}</div>
      <p className="rewards-sub">{t(lang, 'reward.sub')}</p>
      <div className="rewards-list">
        {rewards.map((r) => (
          <div key={r.milestone} className={`reward-item ${r.claimed ? 'claimed' : ''}`}>
            <div className="milestone-level">{t(lang, 'reward.at', { n: r.milestone })}</div>
            <div className="reward-name">{t(lang, r.itemKey)}</div>
            {r.claimed && <div className="claimed-badge">✓</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
