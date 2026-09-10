import { useEffect, useRef, useState } from 'react';

interface DialoguePanelProps {
  speaker: string;
  line: string;
  objective: string;
  lang: 'ru' | 'kk';
}

/**
 * Сворачиваемая панель диалога.
 *
 * Панель лежит поверх сцены, и на телефоне это настоящая плата, когда ребёнок
 * просто хочет осмотреться. Теперь её можно свернуть в одну полоску и раскрыть
 * обратно, а история сохраняется: уехавшую реплику можно перечитать стрелками. До
 * этого каждая новая реплика уничтожала предыдущую, что нечестно по отношению к
 * тому, кто читает медленно.
 */
export function DialoguePanel({ speaker, line, objective, lang }: DialoguePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [history, setHistory] = useState<Array<{ speaker: string; line: string }>>([]);
  const [index, setIndex] = useState(0);
  const lastLine = useRef('');

  useEffect(() => {
    if (!line || line === lastLine.current) return;
    lastLine.current = line;
    setHistory((prev) => {
      const next = [...prev, { speaker, line }].slice(-12);
      setIndex(next.length - 1);
      return next;
    });
  }, [line, speaker]);

  const shown = history[index] ?? { speaker, line };
  const atLatest = index >= history.length - 1;

  if (collapsed) {
    return (
      <button
        type="button"
        className="m0-dialogue-tab"
        onClick={() => setCollapsed(false)}
        aria-label={lang === 'kk' ? 'Мәтінді ашу' : 'Показать текст'}
      >
        <span className="m0-dialogue-tab-icon">💬</span>
        <span className="m0-dialogue-tab-text">{objective || shown.line}</span>
      </button>
    );
  }

  return (
    <div className="m0-dialogue">
      <div className="m0-dialogue-head">
        <span className="m0-speaker">{shown.speaker}</span>
        <div className="m0-dialogue-tools">
          {history.length > 1 ? (
            <>
              <button
                type="button"
                className="m0-dialogue-btn"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label={lang === 'kk' ? 'Алдыңғы' : 'Предыдущая реплика'}
              >
                ‹
              </button>
              <button
                type="button"
                className="m0-dialogue-btn"
                disabled={atLatest}
                onClick={() => setIndex((i) => Math.min(history.length - 1, i + 1))}
                aria-label={lang === 'kk' ? 'Келесі' : 'Следующая реплика'}
              >
                ›
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="m0-dialogue-btn m0-dialogue-collapse"
            onClick={() => setCollapsed(true)}
            aria-label={lang === 'kk' ? 'Жасыру' : 'Свернуть'}
          >
            ⌃
          </button>
        </div>
      </div>

      <div className="m0-line">{shown.line}</div>
      {/* Показывается только активная цель: прокрутка назад нужна для чтения, а не
          для действий по уже выполненной задаче. */}
      {atLatest && objective ? <div className="m0-objective">{objective}</div> : null}
    </div>
  );
}
