#!/usr/bin/env bash
# PostToolUse(Write|Edit) hook: 방금 고친 코드 파일 하나만 lint 한다.
# 실패하면 exit 2로 에이전트를 깨워 그 자리에서 고치게 한다.
# 프로젝트가 아직 세팅되기 전(package.json·eslint 없음)에는 조용히 넘어간다.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
[ -f package.json ] || exit 0
[ -x node_modules/.bin/eslint ] || exit 0

input=$(cat)
f=$(printf '%s' "$input" | jq -r '.tool_response.filePath // .tool_input.file_path // ""')
[ -n "$f" ] || exit 0
printf '%s' "$f" | grep -qE '\.(ts|tsx|js|jsx|mjs|cjs)$' || exit 0
[ -f "$f" ] || exit 0

out=$(node_modules/.bin/eslint "$f" 2>&1); ec=$?
[ $ec -eq 0 ] && exit 0
echo "lint 실패 — $f"
echo "$out"
echo "다음 작업으로 넘어가기 전에 위 에러를 고친다."
exit 2
