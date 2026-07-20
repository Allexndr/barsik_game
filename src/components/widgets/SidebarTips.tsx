import './SidebarTips.css';

export function SidebarTips() {
  const tips = [
    "Барсик скучает по тебе! 💔",
    "Сегодня появился новый друг! 🎉",
    "Помоги Путало найти дорогу домой! 🦊",
  ];

  const tip = tips[Math.floor(Math.random() * tips.length)];

  return (
    <div className="sidebar-tips">
      <div className="tips-header">💬 Совет</div>
      <div className="tip-bubble">{tip}</div>
    </div>
  );
}
