# Инструменты озвучки для игры — исследование

## Текущая реализация

**AudioManager** (`src/audio/AudioManager.ts`) — единый аудио-менеджер:
- **SFX**: процедурные звуки через Web Audio API (осцилляторы, 0 загрузок)
- **TTS**: озвучка текста через Web Speech API (встроен в браузер)
- **Mute/volume**: синхронизация с `useUIStore.muted`
- **Auto-init**: активируется при первом клике (autoplay policy)

---

## Инструменты TTS — сравнение

### 1. Web Speech API (SpeechSynthesis) ✅ Используется
- **Тип**: встроен в браузер
- **Зависимости**: 0
- **Размер**: 0 KB
- **Качество**: среднее (зависит от ОС/браузера)
- **Оффлайн**: да
- **Языки**: ru-RU, kk-KZ (если установлены в ОС)
- **Плюсы**: мгновенный старт, без загрузки, бесплатно
- **Минусы**: качество зависит от устройства, роботизированный голос на некоторых ОС
- **Ссылка**: [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)

### 2. easy-speech (npm)
- **Тип**: обёртка над Web Speech API
- **Зависимости**: 0
- **Размер**: ~5 KB
- **Качество**: = Web Speech API
- **Плюсы**: кросс-браузерная совместимость, async API, хуки событий
- **Минусы**: те же голоса что и Web Speech API
- **Ссылка**: [github.com/leaonline/easy-speech](https://github.com/leaonline/easy-speech)

### 3. kokoro-js (npm, Apache-2.0) ⭐ Рекомендуется для апгрейда
- **Тип**: нейросетевой TTS, 82M параметров
- **Зависимости**: @huggingface/transformers, phonemizer
- **Размер модели**: ~300MB (кешируется после первой загрузки)
- **Качество**: высокое (сопоставимо с коммерческими TTS)
- **Оффлайн**: да (после загрузки модели)
- **Языки**: английский, мультиязычный (проверить поддержку ru/kk)
- **Устройство**: WebGPU (быстро) или WASM (медленнее)
- **Плюсы**: качество коммерческого уровня, 100% локально, приватность
- **Минусы**: 300MB загрузка, нужен WebGPU для скорости, не все языки
- **Ссылка**: [npm kokoro-js](https://www.npmjs.com/package/kokoro-js), [github hexgrad/kokoro](https://github.com/hexgrad/kokoro)
- **Демо**: [huggingface.co/spaces/webml-community/kokoro-webgpu](https://huggingface.co/spaces/webml-community/kokoro-webgpu)

### 4. tts-react (npm)
- **Тип**: React hook для SpeechSynthesis
- **Зависимости**: React 19
- **Размер**: ~3 KB
- **Качество**: = Web Speech API
- **Плюсы**: готовый React hook, fallback на HTMLAudioElement
- **Минусы**: те же голосы, требует React 19
- **Ссылка**: [github morganney/tts-react](https://github.com/morganney/tts-react)

### 5. Azure AI Speech (облачный)
- **Тип**: облачный TTS (AnaNeural, AmberNeural)
- **Качество**: очень высокое (нейронные голоса)
- **Языки**: ru-RU, kk-KZ
- **Плюсы**: лучшее качество, естественные голоса
- **Минусы**: нужен API ключ, платно, требует интернет, задержка
- **Ссылка**: [azure.microsoft.com/products/ai-services/text-to-speech](https://azure.microsoft.com/products/ai-services/text-to-speech)

### 6. Google Cloud TTS
- **Тип**: облачный TTS
- **Качество**: очень высокое
- **Языки**: ru-RU, kk-KZ
- **Плюсы**: отличное качество, много голосов
- **Минусы**: нужен API ключ, платно, требует интернет
- **Ссылка**: [cloud.google.com/text-to-speech](https://cloud.google.com/text-to-speech)

---

## Рекомендация

### Фаза 1 (сейчас) ✅
**Web Speech API** через `AudioManager` — уже реализовано:
- 0 зависимостей, 0 загрузок
- Базовая озвучка HUD-текста
- SFX (сбор, интеракт, успех, завершение)

### Фаза 2 (будущее) — апгрейд качества
**kokoro-js** для нейронного TTS:
```bash
npm i kokoro-js
```
- Загружать модель лениво при первом заходе в уровень
- Показывать прогресс загрузки
- Fallback на Web Speech API если WebGPU недоступен
- Кешировать модель в IndexedDB

### Фаза 3 (коммерческий) — премиум голоса
**Azure AI Speech** или **Google Cloud TTS**:
- Предгенерировать аудио для всех реплик
- Хранить как .mp3 файлы (по 20-50KB на реплику)
- Загружать лениво с CDN
- Лучшее качество для продакшена

---

## SFX — процедурные звуки (уже реализовано)

Все SFX генерируются через Web Audio API осцилляторами — 0 загрузок:

| Звук | Описание | Когда |
|------|----------|-------|
| `collect` | Восходящий тон 523→784Hz | Сбор фрукта/звезды |
| `bonus` | Тройной восходящий аккорд | Сбор бонуса |
| `interact` | Короткий клик | Нажатие E/Space |
| `success` | Мажорное трезвучие | Успешное действие |
| `stumble` | Нисходящий sawtooth | Ошибка (пошатнулся) |
| `found` | Восходящая мелодия | Найден ёжик/NPC |
| `click` | Короткий высокий тон | Клик кнопки |
| `whoosh` | Свист | Переход/движение |
| `sparkle` | Высокий аккорд | Искры/эффекты |
| `levelComplete` | Фанфары | Завершение уровня |
| `tick` | Тик | Появление интеракта |
