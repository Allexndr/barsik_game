import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { installQaConsoleCollector } from './dev/qaConsole';
import './index.css';

installQaConsoleCollector();

/**
 * Отдельный вход в админку.
 *
 * Развилка стоит здесь, а не внутри `App`, по двум причинам. Первая: панель
 * тогда физически не может смонтироваться внутри детского потока. Вторая:
 * `lazy` разрезает бандл, и ребёнок не скачивает ни байта админки.
 *
 * Вход по query-параметру, а не по пути `/admin`: путь потребовал бы rewrite в
 * `vercel.json`, а этот файл сейчас правит соседняя ветка деплоя. Параметр
 * работает на любом статическом хостинге без настройки. Путь тоже принимается —
 * если rewrite когда-нибудь появится, менять здесь ничего не придётся.
 */
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })));

const params = new URLSearchParams(window.location.search);
const isAdminEntry =
  params.get('admin') === '1' || window.location.pathname.replace(/\/+$/, '') === '/admin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminEntry ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
