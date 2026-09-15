#!/usr/bin/env bash
# Stop hook: 턴이 끝날 때 코드 변경이 있었으면 build를 강제한다.
# 실패하면 exit 2로 에이전트를 다시 깨운다 ("코드 완료 = build 통과").
#
# 이 턴에 이미 커밋된 변경(HEAD)도 검사 대상에 넣는다 — 검증 전에 커밋해
# 작업 트리를 깨끗하게 만들어 검사를 건너뛰는 구멍을 막는다.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
[ -f package.json ] || exit 0
jq -e '.scripts.build' package.json >/dev/null 2>&1 || exit 0
CODE_RE='\.(ts|tsx|js|jsx|mjs|cjs)$'

{ git status --porcelain 2>/dev/null; git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null; } \
  | grep -qE "$CODE_RE" || exit 0

BUILD_CMD="${BUILD_CMD:-npm run build}"
out=$($BUILD_CMD 2>&1); ec=$?
[ $ec -eq 0 ] && exit 0
echo "build 실패($BUILD_CMD). 턴을 끝내기 전에 고친다:"
echo "$out" | tail -60
exit 2
