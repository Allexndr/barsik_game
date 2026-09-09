# BLOCKER — решения перед release

Дата: 2026-08-30

Остановка только по границам, которые нельзя безопасно решить кодом без владельца
продукта/инфраструктуры.

| Блокер | Что проверено | Варианты | Рекомендация |
|---|---|---|---|
| Server-authoritative progression | контракт, completion RPC и локальные guards существуют; reconciliation не задан | server wins; merge by version; explicit conflict screen | server wins + versioned client cache |
| Identity-based admin | Bearer identity/roles подготовлены; staging role matrix не выполнена | app metadata; отдельная ACL table; external IdP | app metadata + auditable role matrix |
| Durable rate limiting | SQL RPC и edge integration подготовлены; multi-instance production-like test отсутствует | DB counter; Redis; provider gateway | DB RPC для текущего масштаба, затем load test |
| CORS / Realtime | exact-origin code есть; production origins/RLS/rooms не подтверждены | allowlist per env; gateway policy; disable realtime | allowlist + explicit room authorization |
| Performance / assets | локальный build показывает крупные chunks; device budget не задан | split by level; compression/cache; asset LOD | сначала budget и измерение, затем split/cache |
| Admin overview SQL | RPC aggregation подготовлена; representative `EXPLAIN` нет | RPC aggregate; materialized view; async analytics | RPC с indexes, подтвердить explain |
| Full test harness | unit + Playwright smoke есть; API fixtures, full gameplay and device matrix нет | expand Playwright; API integration harness; both | Playwright critical path + API fixtures |

До ответов владельца не менять RLS/Realtime policy, reconciliation semantics, production
rate-limit backend, schema/migrations или deploy configuration.
