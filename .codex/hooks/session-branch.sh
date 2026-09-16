#!/usr/bin/env bash
# SessionStart hook: 세션을 열 때 현재 브랜치를 알린다.
# main(또는 master)이면 작업 전에 dev로 옮기라고 안내한다.
#
# 안내만 하고 브랜치를 바꾸지는 않는다. 작업 중인 변경이 있을 수 있어
# 자동 전환은 위험하고, 어디서 작업할지는 사용자가 정할 일이다.
#
# 참고: 백로그 done 시 자동 push hook은 "현재 브랜치"로 밀기 때문에
# dev에 있으면 dev로, main에 있으면 main으로 간다. 그래서 세션 시작 시점에
# 어디에 서 있는지 먼저 확인시키는 것이 의미가 있다.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch=$(git branch --show-current 2>/dev/null)
[ -n "$branch" ] || exit 0

WORK_BRANCH="${WORK_BRANCH:-dev}"

emit() { # $1=사용자 표시 메시지  $2=모델 컨텍스트
  jq -nc --arg m "$1" --arg c "$2" \
    '{systemMessage: $m,
      hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $c}}'
}

case "$branch" in
  main|master)
    # dev가 이미 있으면 switch, 없으면 새로 만들어야 한다
    if git show-ref --verify --quiet "refs/heads/$WORK_BRANCH"; then
      cmd="git switch $WORK_BRANCH"
      note="$WORK_BRANCH 브랜치가 이미 있다"
    elif git show-ref --verify --quiet "refs/remotes/origin/$WORK_BRANCH"; then
      cmd="git switch $WORK_BRANCH"
      note="origin/$WORK_BRANCH를 받아 온다"
    else
      cmd="git switch -c $WORK_BRANCH"
      note="$WORK_BRANCH 브랜치가 없어 새로 만든다"
    fi
    dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    extra=""
    [ "$dirty" != "0" ] && extra="
  (커밋 안 된 변경 ${dirty}건이 있다. 브랜치를 옮기면 함께 따라간다.)"
    emit "⚠️  현재 브랜치: ${branch} — 작업 전에 ${WORK_BRANCH}로 옮긴다
  ${cmd}    # ${note}${extra}" \
"현재 작업 중인 git 브랜치: ${branch}
이 프로젝트는 ${branch}에서 직접 작업하지 않는다.
코드나 백로그를 바꾸는 작업을 시작하기 전에, 사용자에게 '${cmd}'로 ${WORK_BRANCH} 브랜치로
옮길 것을 먼저 안내한다 (${note}). 사용자 승인 없이 브랜치를 바꾸지 않는다.
단순 조회·질문 답변은 그대로 진행해도 된다."
    ;;
  *)
    emit "🌿 현재 브랜치: ${branch}" \
"현재 작업 중인 git 브랜치: ${branch}
백로그 done 시 자동 push는 이 브랜치로 나간다."
    ;;
esac
exit 0
