import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { t } from '@/i18n';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { IconCheck, IconStar } from '@/components/ui/icons';
import './RewardsBar.css';

const MILESTONES = [
  { milestone: 20, itemKey: 'reward.stickers' as const },
  { milestone: 40, itemKey: 'reward.mug' as const },
  { milestone: 60, itemKey: 'reward.shirt' as const },
  { milestone: 80, itemKey: 'reward.backpack' as const },
  { milestone: 100, itemKey: 'reward.grand' as const },
];

export function RewardsBar() {
  const lang = useUIStore((s) => s.lang);
  const stars = useGameStore((s) => s.stars);

  const next = MILESTONES.find((r) => stars < r.milestone) ?? MILESTONES[MILESTONES.length - 1];
  const prevThreshold = MILESTONES.filter((r) => r.milestone <= stars).at(-1)?.milestone ?? 0;

  return (
    <div className="rewards-bar">
      <div className="rewards-header">{t(lang, 'reward.title')}</div>
      <p className="rewards-sub">{t(lang, 'reward.sub')}</p>

      <div className="rewards-next">
        <Chip icon={<IconStar size={16} />} tone="star">
          {stars}
        </Chip>
        <ProgressBar
          value={stars - prevThreshold}
          max={Math.max(1, next.milestone - prevThreshold)}
          label={t(lang, 'reward.at', { n: next.milestone })}
        />
      </div>

      <div className="rewards-list">
        {MILESTONES.map((r) => {
          const claimed = stars >= r.milestone;
          return (
            <div key={r.milestone} className={`reward-item ${claimed ? 'claimed' : ''}`}>
              <div className="milestone-level">{t(lang, 'reward.at', { n: r.milestone })}</div>
              <div className="reward-name">{t(lang, r.itemKey)}</div>
              {claimed && (
                <div className="claimed-badge">
                  <IconCheck size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
