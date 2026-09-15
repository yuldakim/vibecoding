#!/usr/bin/env bash
# PreToolUse(Read|Edit|Write|NotebookEdit|Bash) hook:
# backlog.json 직접 조회·수정을 실행 전에 차단하고 CLI 사용법을 안내한다.
#
# 왜: backlog.json은 작업 상태의 SSOT다. 손으로 읽으면 96개 태스크가 통째로
# 컨텍스트에 실리고, 손으로 고치면 id 채번·상태 전이 규칙·doc 경로 불변식이
# 깨진다. CLI(tools/backlog.mjs)는 쓰기 전에 전량 검증하므로 그 경로만 허용한다.
#
# 한계(의도됨): Bash 경유 우회는 문자열 검사로만 막는다. 정당한 경로인
# tools/backlog.mjs 호출과 git 명령은 통과시킨다.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0

GUIDE='backlog.json은 직접 열거나 고치지 않는다. CLI를 쓴다:

  조회   node tools/backlog.mjs              (미완료 전체)
         node tools/backlog.mjs next         (지금 시작 가능한 작업)
         node tools/backlog.mjs get <id>     (한 작업 상세)
         node tools/backlog.mjs list --phase 송장 --status todo
         node tools/backlog.mjs stats

  수정   node tools/backlog.mjs set <id> <상태> [--note "사유"]
         node tools/backlog.mjs edit <id> --priority P1 --deps "1,2"
         상태: todo in_progress review needs_decision blocked done cancelled

  추가   node tools/backlog.mjs add --title "제목" --category feature --phase "2. 송장"

  작업 내용 상세는 docs/tasks/<id>.md 를 직접 읽으면 된다.
  전체 사용법은 node tools/backlog.mjs --help'

deny() {
  jq -nc --arg r "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // ""')

case "$tool" in
  Bash)
    cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
    printf '%s' "$cmd" | grep -q 'backlog\.json' || exit 0
    # 정당한 경로는 통과: CLI 호출, git 명령(스테이징·조회)
    printf '%s' "$cmd" | grep -q 'tools/backlog\.mjs' && exit 0
    printf '%s' "$cmd" | grep -qE '(^|[;&|] *)git ' && exit 0
    deny "backlog.json을 셸로 직접 다루지 않는다.

$GUIDE"
    ;;
  Read|Edit|Write|NotebookEdit)
    path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')
    [ -n "$path" ] || exit 0
    [ "$(basename "$path")" = "backlog.json" ] || exit 0
    deny "$GUIDE"
    ;;
esac
exit 0
