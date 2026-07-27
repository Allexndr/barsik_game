/**
 * Тонкая обёртка над console для единообразного логирования.
 *
 * Раньше многие ошибки (в основном сбои localStorage/JSON.parse) молча
 * проглатывались через `catch { /* ignore *\/ }`, из-за чего их было
 * невозможно диагностировать. Теперь такие места логируются через
 * `logWarn`, а неожиданные ошибки — через `logError`, при этом поведение
 * graceful degradation сохраняется (мы по-прежнему не роняем игру).
 */

const isDev = Boolean(
  typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV,
);

/**
 * Ожидаемая, некритичная ошибка (например, недоступный localStorage
 * в приватном режиме). Шумит только в dev, чтобы не засорять консоль детям.
 */
export function logWarn(scope: string, error: unknown): void {
  if (isDev) {
    console.warn(`[barsik:${scope}]`, error);
  }
}

/**
 * Неожиданная ошибка, которую стоит видеть всегда (в т.ч. в проде).
 */
export function logError(scope: string, error: unknown): void {
  console.error(`[barsik:${scope}]`, error);
}
