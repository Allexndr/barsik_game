#!/usr/bin/env bash
# Spawn Barsik S1 department as Claude background agents.
# Usage: ./scripts/spawn-barsik-dept.sh
set -euo pipefail
cd /Users/aleksandr/Project/other/job/barsik-game
mkdir -p /tmp/barsik-dept
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_MODEL CLAUDE_API_KEY || true

# Do NOT use -p/--print with --bg. Pass the task as positional prompt.
spawn() {
  local name="$1"
  local prompt="$2"
  echo "→ $name"
  claude --bg -n "$name" --dangerously-skip-permissions "$prompt" \
    | tee "/tmp/barsik-dept/${name}.boot.log"
  sleep 2
}

COMMON='CWD barsik-game. Follow CLAUDE.md. Style Lock soft-3D. No Supabase writes. No force-push. Small diffs. After code: npx tsc --noEmit.'

spawn barsik-lead "$COMMON ROLE=lead. Read CLAUDE.md and docs/S1_COMPLETION_PLAN.md. Write prioritized next actions to docs/S1_DEPT_STATUS.md. No gameplay code."
spawn barsik-levels-forest "$COMMON ROLE=levels-forest. Premium-bar L1-L9. Touch only Mission1/2/4/5/6/8/9 and Level3/Level7 scenes. placeProps not placeMany. Make 1-3 fixes then summarize."
spawn barsik-levels-ice "$COMMON ROLE=levels-ice. Premium-bar L10-L16. Touch only Mission10-16 scenes. placeProps not placeMany. Make 1-3 fixes then summarize."
spawn barsik-hub-ui "$COMMON ROLE=hub-ui. Polish Welcome TravelMap Friends City Shop under src/components only. Portrait map centered. No multiplayer."
spawn barsik-qa "$COMMON ROLE=qa. Create docs/S1_QA_SESSION.md for L0 L1 L8 L16. Note blockers. Fix only proven soft-locks."
spawn barsik-perf "$COMMON ROLE=perf. FPS via renderQuality.ts and BaseLevelScene. Write docs/S1_PERF_NOTES.md."
spawn barsik-audio-i18n "$COMMON ROLE=audio-i18n. Audit RU/KK and SFX. Write docs/S1_AUDIO_I18N_NOTES.md. Never swap RU voice for KK."
spawn barsik-review "$COMMON ROLE=review. Review git diff excluding dist. Write docs/S1_AGENT_REVIEW.md."

echo
echo "Watch: Pixel Agents (Watch All Sessions) · claude agents · claude logs <id> · claude attach <id>"
echo "Stop one: claude stop <id>"
