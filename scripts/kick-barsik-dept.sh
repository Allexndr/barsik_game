#!/usr/bin/env bash
# Mass-assign a sprint goal to the Barsik department (coop via docs/S1_BOARD.md).
# Usage:
#   ./scripts/kick-barsik-dept.sh "опциональный sprint goal"
#   ./scripts/kick-barsik-dept.sh --restart   # stop idle/busy barsik-* then respawn
set -euo pipefail
ROOT="/Users/aleksandr/Project/other/job/barsik-game"
cd "$ROOT"
mkdir -p /tmp/barsik-dept
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_MODEL CLAUDE_API_KEY || true

GOAL="${1:-Continue S1 board sprint. Read docs/S1_BOARD.md, claim next Todo for your role, implement, update board, then take another Todo. Do not go idle while Todo for your role remains.}"
RESTART=0
if [[ "${1:-}" == "--restart" ]]; then
  RESTART=1
  GOAL="${2:-Continue S1 board sprint. Read docs/S1_BOARD.md, claim next Todo for your role, implement, update board, then take another Todo. Do not go idle while Todo for your role remains.}"
fi

COMMON="Work in $ROOT on branch levels-premium-pass. Prefer NOT creating new git worktrees — edit the main checkout. Follow CLAUDE.md. Style Lock soft-3D. No Supabase/leaderboard writes. No force-push. Small diffs. After code: npx tsc --noEmit. COOP: always read+update docs/S1_BOARD.md (claim/in-progress/done/handoffs). After finishing one task immediately take the next Todo for your ROLE. Sprint goal: $GOAL"

if [[ "$RESTART" -eq 1 ]]; then
  echo "Stopping existing barsik-* sessions..."
  claude agents --json --all 2>/dev/null | python3 -c '
import json,sys,subprocess
d=json.load(sys.stdin)
for a in d:
  n=str(a.get("name") or "")
  if not n.startswith("barsik"): continue
  sid=str(a.get("sessionId") or "")[:8]
  if not sid: continue
  subprocess.run(["claude","stop",sid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
  print(" stopped", n, sid)
' || true
  sleep 2
fi

spawn() {
  local name="$1"
  local role_prompt="$2"
  echo "→ kick $name"
  claude --bg -n "$name" --dangerously-skip-permissions \
    "$COMMON ROLE=$role_prompt" \
    | tee "/tmp/barsik-dept/kick-${name}.log"
  sleep 2
}

spawn barsik-lead "lead. Own docs/S1_BOARD.md priorities. Reorder Todo from S1_COMPLETION_PLAN. No gameplay code. After others Done, refresh board."
spawn barsik-levels-forest "levels-forest. Only Mission1/2/4/5/6/8/9 + Level3/Level7. placeProps not placeMany. Claim forest Todo items one by one."
spawn barsik-levels-ice "levels-ice. Only Mission10-16. placeProps not placeMany. Claim ice Todo items one by one."
spawn barsik-hub-ui "hub-ui. Only src/components/**. Portrait map. Claim hub Todo items. No multiplayer."
spawn barsik-qa "qa. Maintain docs/S1_QA_SESSION.md. Soft-lock fixes only. Claim qa Todo. Ping handoffs to levels-* when blocked."
spawn barsik-perf "perf. renderQuality + BaseLevelScene quality only. Update docs/S1_PERF_NOTES.md. Claim perf Todo."
spawn barsik-audio-i18n "audio-i18n. RU/KK + SFX. docs/S1_AUDIO_I18N_NOTES.md. Never silent RU VO for KK. Claim audio Todo."
spawn barsik-review "review. Read board Done + git status. Update docs/S1_AGENT_REVIEW.md. Minimal code. Flag conflicts on board Blocked."

echo
echo "Mass kick done. Watch:"
echo "  claude agents"
echo "  claude logs <id>"
echo "  docs/S1_BOARD.md   ← coop board"
echo "Pixel Agents: Watch All Sessions (worktrees may still hide --bg agents)"
