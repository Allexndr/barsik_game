# Bug Report — platform audit

**Дата:** 12.09.2026 · **Scope:** текущая локальная ветка; production не изменялся.

| ID | Тип | Severity | Область | Статус |
|---|---|---|---|---|
| BUG-SEC-001 | data/authz | high | client-controlled local save | open by design; server authority needed for competitive rewards |
| BUG-SEC-002 | security | high | legacy admin token | mitigated by default-off flag; remove after identity migration |
| BUG-SEC-003 | security/child-safety | high | realtime direct broadcast | default-off; must fix before enabling multiplayer |
| BUG-SEC-004 | data | medium | admin PATCH schema | open |
| BUG-SEC-005 | abuse | medium | city-say device/rate limit | open before public chat |
| BUG-SEC-006 | session | medium | refresh token in localStorage | open hardening |
| BUG-SEC-007 | infra | low | public model/debug pages | open release hygiene |
| BUG-SEC-008 | config | low | public Supabase fallback key | open rotation hygiene |
| BUG-FUNC-001 | functional | medium | admin API under local Vite | expected limitation, not product bug; preview test required |
| BUG-QA-001 | qa/performance | high | device performance unproven | open: headless evidence is insufficient |
| BUG-QA-002 | qa/content | high | full child playtest not completed | open: technical golden path 17/17, real children still required |

## Функциональные находки сезона — статус после исправлений

| ID | Уровень | Severity | Статус |
|---|---|---|---|
| BUG-L0-RECOVERY | L0 | major | fixed; перепроверено, `outro` |
| BUG-L2-TARGET | L2 | critical | fixed; перепроверено, `outro` |
| BUG-L6-RECOVERY | L6 | major | fixed; перепроверено, `outro` |
| BUG-L7-STEALTH | L7 | major | fixed; перепроверено, `outro` |
| BUG-L9-TARGET | L9 | critical | fixed; перепроверено, `outro` |
| BUG-L10-CAMERA | L10 | major | fixed; перепроверено, `outro` |
| BUG-L11-VISIBILITY | L11 | major | fixed; перепроверено, `outro` |
| BUG-L12-RECOVERY | L12 | major | fixed; перепроверено, `outro` |

### BUG-L0-RECOVERY

- **Шаги:** пройти переправу по камням, ошибиться после нескольких достигнутых камней.
- **Ожидание:** Барсик возвращается к последней безопасной точке и видит следующий маршрут.
- **Факт до исправления:** возврат на берег стирал прогресс и оставлял неясной цель у юрты.
- **Причина:** recovery всегда сбрасывал `furthestStoneIdx`.
- **Рекомендация/результат:** возвращать на последний камень, расширить безопасные зоны и показать сухой берег; исправлено.

### BUG-L2-TARGET

- **Шаги:** взять яблоко, встать между соседними корзинами и нажать E.
- **Ожидание:** действие доступно только для корзины нужного цвета из HUD.
- **Факт до исправления:** ближайшая неправильная корзина могла перехватить действие, а коллайдер мешал подойти к правильной.
- **Причина:** `nearestInteract()` выбирал соседний объект по расстоянию; корзины были стенами.
- **Рекомендация/результат:** фильтровать корзины по `carryingColor` и убрать их физические коллайдеры; исправлено.

### BUG-L6-RECOVERY

- **Шаги:** выбрать неверное дерево в загадке.
- **Ожидание:** ребёнок понимает, куда вернуться и какую кнопку нажать.
- **Факт до исправления:** возврат к пеньку выглядел как сброс без ясного действия.
- **Причина:** слабая подсветка пенька и короткий текст HUD.
- **Рекомендация/результат:** усилить свечение и явно написать про E/лапку; исправлено.

### BUG-L7-STEALTH

- **Шаги:** начать быстро двигаться к Путало, ошибиться во время наблюдения.
- **Ожидание:** есть раннее предупреждение и ошибка не стирает весь прогресс.
- **Факт до исправления:** рывок происходил внезапно и сбрасывал доверие.
- **Причина:** узкое окно остановки и полный сброс `trust`.
- **Рекомендация/результат:** расширить дистанцию предупреждения, частично снижать доверие и оставить короткое recovery-окно; исправлено.

### BUG-L9-TARGET

- **Шаги:** открыть замок, встать между столбами и нажать E по соседнему знаку.
- **Ожидание:** интерактивен только столб с текущим символом замка.
- **Факт до исправления:** HUD и кнопка действия могли указывать на разные столбы.
- **Причина:** интерактивность выбиралась только по расстоянию.
- **Рекомендация/результат:** фильтровать по текущему `LOCK_ORDER` и показывать цель сразу; исправлено.

### BUG-L10-CAMERA

- **Шаги:** подойти к финальному NPC на узкой лесной тропе.
- **Ожидание:** камера держит героя и цель в кадре.
- **Факт до исправления:** крона дерева попадала внутрь камеры и закрывала обзор.
- **Причина:** генератор проверял лес за деревом, а не будущую позицию камеры.
- **Рекомендация/результат:** проверять сторону камеры со стороны героя и отводить конфликтующие кроны; исправлено.

### BUG-L11-VISIBILITY

- **Шаги:** начать сбор снежинок на белом поле.
- **Ожидание:** снежинка и место падения заметны без поиска пикселей.
- **Факт до исправления:** белая снежинка терялась на снегу.
- **Причина:** малый размер и низкий контраст материала.
- **Рекомендация/результат:** голубой/золотой контраст, свечение, ореол и кольцо приземления; исправлено.

### BUG-L12-RECOVERY

- **Шаги:** на скользком спуске уйти за край тропы.
- **Ожидание:** после возврата понятно, в какую сторону корректировать стик.
- **Факт до исправления:** сообщение «попробуй ещё» не давало направления.
- **Причина:** стрелка оставалась на кристалле, а коридор быстро сужался.
- **Рекомендация/результат:** направлять на ближайшие ворота, расширить коридор и снизить инерцию; исправлено.

### BUG-SEC-001

- **Шаги:** открыть DevTools → Local Storage → изменить `barsik_progress` (`unlockedLevels`, `stars`) → reload.
- **Ожидание:** ценностной прогресс нельзя подделать.
- **Факт:** local-first client state принимает значение; облачный RPC защищает только sync path.
- **Причина:** `useGameStore`/`migrateProgress` — локальное хранилище без подписи.
- **Рекомендация:** server-authoritative progression для рейтинга/призов; conflict policy для local/server.

### BUG-SEC-002

- **Шаги:** включить `ADMIN_ALLOW_LEGACY_TOKEN=true`, получить shared token, вызвать `/api/admin/players`.
- **Ожидание:** короткая identity session и scope.
- **Факт:** shared token с custom header авторизует весь admin perimeter; expiry/MFA нет.
- **Причина:** миграционный legacy branch в `_lib.ts`.
- **Рекомендация:** удалить legacy branch после staging identity migration; секреты не публиковать.

### BUG-SEC-003

- **Шаги:** включить `VITE_HUB_REALTIME=1`, открыть console и отправить собственный Supabase broadcast.
- **Ожидание:** сообщения проходят server moderation.
- **Факт:** `src/net/hub.ts` отправляет direct `t`/`s` broadcast; изменённый клиент может обойти `city-say`.
- **Причина:** два несовместимых транспортных пути.
- **Рекомендация:** оставить один server-mediated channel; до этого realtime не включать.

### BUG-SEC-004

- **Шаги:** авторизованный admin отправляет PATCH с `levels: 999999`, `stars: "text"` или malformed `data`.
- **Ожидание:** 400 с описанием schema violation.
- **Факт:** поле проходит allow-list и передаётся в PostgREST.
- **Причина:** проверяется имя поля, но не его тип/bounds.
- **Рекомендация:** schema validation + optimistic version check + audit before/after.

### BUG-SEC-005

- **Шаги:** вызвать `city-say` с разными `device` и повторять запросы через cold starts.
- **Ожидание:** глобальный rate limit по анонимной сессии.
- **Факт:** client-provided device и warm-instance Map можно менять/обходить; durable RPC снижает, но не устраняет риск.
- **Рекомендация:** server-issued subject, atomic quota, abuse metrics.

### BUG-SEC-006

- **Ожидание:** refresh token недоступен JavaScript-коду.
- **Факт:** `barsik_auth_session` хранится в localStorage.
- **Рекомендация:** BFF/httpOnly cookie или короткая сессия без durable refresh; CSP.

### BUG-QA-001

- **Ожидание:** ≥30 FPS на target phone.
- **Факт:** headless tests PASS, но samples не являются доказательством minimum-device FPS.
- **Рекомендация:** real-device matrix L0/L1/L8/L16 с avg/p5/load/memory.

### BUG-QA-002

- **Ожидание:** ребёнок понимает и завершает каждый сезонный уровень.
- **Факт:** технический контур завершил L0→L16 до `outro` без console/page/network
  ошибок; это не измеряет понятность для ребёнка и не заменяет наблюдение.
- **Рекомендация:** golden-path script + наблюдение 5–8 детей 10–14 лет, фиксация места остановки.
