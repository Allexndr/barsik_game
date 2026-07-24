import { useMemo } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { IconPaw } from '@/components/ui/icons';
import './SidebarTips.css';

const TIPS: Record<'ru' | 'kk', string[]> = {
  ru: [
    'Барсик скучает по тебе — загляни в гости!',
    'Сегодня появился новый друг!',
    'Помоги Путало найти дорогу домой.',
  ],
  kk: [
    'Барсик сені сағынды — қонаққа кел!',
    'Бүгін жаңа дос пайда болды!',
    'Путалоға үйіне жол табуға көмектес.',
  ],
};

export function SidebarTips() {
  const lang = useUIStore((s) => s.lang);
  const tip = useMemo(() => {
    const list = TIPS[lang];
    return list[Math.floor(Math.random() * list.length)];
  }, [lang]);

  return (
    <div className="sidebar-tips">
      <Chip icon={<IconPaw size={14} />} tone="neutral" className="tips-header">
        {lang === 'kk' ? 'Кеңес' : 'Совет'}
      </Chip>
      <div className="tip-bubble">{tip}</div>
    </div>
  );
}
