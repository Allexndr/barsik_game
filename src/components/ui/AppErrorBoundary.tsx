import { Component, type ErrorInfo, type ReactNode } from 'react';
import { readStoredLang, type Lang } from '@/i18n';

type Props = { children: ReactNode };
type State = { error: Error | null; lang: Lang };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, lang: readStoredLang() };

  static getDerivedStateFromError(error: Error): State {
    return { error, lang: readStoredLang() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] render_error', {
      name: error.name,
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;
    const kk = this.state.lang === 'kk';
    return (
      <main role="alert" style={{ padding: 24, textAlign: 'center' }}>
        <h1>{kk ? 'Бір нәрсе дұрыс болмады' : 'Что-то пошло не так'}</h1>
        <p>{kk ? 'Ойынды қайта жүктеп көр.' : 'Попробуй перезагрузить игру.'}</p>
        <button type="button" onClick={this.reload}>
          {kk ? 'Қайта жүктеу' : 'Перезагрузить'}
        </button>
      </main>
    );
  }
}
