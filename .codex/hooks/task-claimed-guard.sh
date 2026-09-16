#!/usr/bin/env bash
# PreToolUse(Write|Edit|NotebookEdit) hook:
# in_progress인 작업이 하나도 없으면 산출물 파일 수정을 차단한다.
#
# 왜: "작업 시작 = in_progress"를 문서로만 두면 지켜지지 않는다. 상태를 안
# 바꾸고 작업하면 그 작업은 백로그상 아무도 안 하고 있는 것이 되고, 다른
# 세션이 next로 같은 작업을 중복으로 집는다. 턴이 끊겼을 때 어디까지 손댔는지
# 알 방법도 사라진다.
#
# 면제: .claude/** (하네스 자체 손보기) · docs/** (문서·태스크 브리핑) ·
#       저장소 루트의 *.md (CLAUDE.md·README.md·설계.md) · backlog.json
#       → 백로그 작업의 산출물이 아니라 그 작업을 준비·기록하는 파일들이다.
#
# 한계(의도됨): Bash 경유 수정(sed -i, > 리다이렉트)은 막지 않는다. 문자열로
# 판별하면 오탐이 너무 잦다 — 그쪽은 규칙(.claude/rules/백로그-운영.md)이 맡는다.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
[ -f backlog.json ] || exit 0

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')
[ -n "$path" ] || exit 0

# 경로 정규화: 상대 → 절대 → 심볼릭링크 해소 → repo 루트 기준 상대 경로
root=$(pwd -P)
case "$path" in
  /*) abs="$path" ;;
  *)  abs="$root/$path" ;;
esac
pdir=$(cd "$(dirname "$abs")" 2>/dev/null && pwd -P) || pdir=""
[ -n "$pdir" ] && abs="$pdir/$(basename "$abs")"
case "$abs" in "$root"/*) ;; *) exit 0 ;; esac   # 프로젝트 밖이면 관여하지 않는다
rel="${abs#"$root"/}"

# ── 면제 경로
case "$rel" in
  .claude/*|docs/*|backlog.json) exit 0 ;;
esac
case "$rel" in
  */*)   ;;                  # 하위 디렉터리 파일은 계속 검사
  *.md)  exit 0 ;;           # 루트의 마크다운 문서만 면제
esac

# ── in_progress인 작업이 하나라도 있으면 통과
n=$(jq -r '[.tasks[]|select(.status=="in_progress")]|length' backlog.json 2>/dev/null)
case "$n" in ''|*[!0-9]*) exit 0 ;; esac   # 백로그를 못 읽으면 막지 않는다
[ "$n" -gt 0 ] && exit 0

reason="파일을 고치기 전에 작업을 in_progress로 바꾼다.

지금 in_progress인 작업이 하나도 없다. 무엇을 하는 중인지 백로그에 남기지 않으면
다른 세션이 같은 작업을 중복으로 집고, 턴이 끊겼을 때 어디까지 했는지 알 수 없다.

  1) 백로그에 있는 작업이면
       node tools/backlog.mjs next              # 지금 시작할 수 있는 작업
       node tools/backlog.mjs set <id> 진행

  2) 백로그에 없는 즉흥 작업이면 먼저 등록한다
       node tools/backlog.mjs add --title \"제목\" --category feature --phase \"2. 송장\"
       node tools/backlog.mjs set <새 id> 진행

  3) 백로그와 무관한 일이면 사용자에게 확인한다.

막힌 파일: ${rel}
면제 경로: .claude/** · docs/** · 저장소 루트의 *.md"

jq -nc --arg r "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $r
  }
}'
exit 0
