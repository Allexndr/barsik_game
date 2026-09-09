# Voice personas (RU/KK · female/male)

## Runtime
- Settings → **Голос / Дауыс**: Женский (`f`) | Мужской (`m`)
- Packs: `public/assets/voice/{lang}/` (female, default) and `public/assets/voice/m/{lang}/` (male)
- Preview clips: `public/assets/voice/previews/edge_{ru|kk}_{f|m}.mp3`

## Render
```bash
# Male pack (Edge — real RU Dmitry + KK Daulet)
node scripts/synth-voice.mjs --persona m

# Female refresh (Edge Svetlana + Aigul)
node scripts/synth-voice.mjs --persona f

# Hybrid: RU via Together Orpheus, KK via Edge
export TOGETHER_API_KEY=…   # from .env.local, never commit
node scripts/synth-voice.mjs --backend hybrid --persona f
node scripts/synth-voice.mjs --backend hybrid --persona m
```

## Together vs Edge
- **Edge** has native `kk-KZ-AigulNeural` / `DauletNeural` and `ru-RU-Svetlana` / `Dmitry` — production default.
- **Together** (Orpheus/Kokoro) is warmer on Russian but **not** a real Kazakh TTS; use `--backend hybrid` if you want Together RU + Edge KK.
