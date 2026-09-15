#!/usr/bin/env bash
# PostToolUse(Bash) hook: backlog.json이 바뀌면 자동으로 커밋한다.
#
# 두 갈래로 동작한다.
#   1) 일반 변경(상태 전이·추가·수정) → backlog.json과 docs/tasks만 커밋.
#   2) 어떤 작업이 done으로 바뀜      → 작업 트리 전체를 정리해 커밋하고 push.
#      "작업 하나가 끝났다"는 신호이므로 그 작업으로 만든 코드까지 함께 올린다.
#
# done 판정은 CLI 호출을 가로채는 대신 HEAD와 작업 트리의 done 목록을 비교해서
# 한다. 어떤 경로로 바뀌었든 잡히고, 같은 작업을 두 번 올리지 않는다.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
[ -f backlog.json ] || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
branch=$(git branch --show-current 2>/dev/null)
[ -n "$branch" ] || exit 0

# 변경이 없으면 즉시 종료 (모든 Bash 호출마다 도는 hook이라 이 검사가 싸야 한다)
git diff --quiet HEAD -- backlog.json 2>/dev/null && exit 0

done_ids() { jq -r '[.tasks[]|select(.status=="done")|.id]|sort|join(" ")' 2>/dev/null; }
prev=$(git show HEAD:backlog.json 2>/dev/null | done_ids)
curr=$(done_ids < backlog.json)

newly=""
for id in $curr; do
  case " $prev " in *" $id "*) ;; *) newly="$newly $id" ;; esac
done
newly="${newly# }"

title_of() { jq -r --arg i "$1" '.tasks[]|select(.id==$i)|.title' backlog.json 2>/dev/null; }
progress=$(jq -r '"\([.tasks[]|select(.status=="done")]|length)/\(.tasks|length)"' backlog.json 2>/dev/null)

if [ -n "$newly" ]; then
  # 작업 완료 — 작업 내역 전체를 정리해 커밋하고 push
  lines=""; head=""
  for id in $newly; do
    t=$(title_of "$id")
    lines="${lines}- ${id} ${t}
"
    [ -z "$head" ] && head="${id} ${t}"
  done
  git add -A >/dev/null 2>&1
  msg="feat(backlog): ${head} 완료

완료 작업:
${lines}
진행: ${progress}

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
  if ! git commit -q -m "$msg" 2>/dev/null; then
    jq -nc '{systemMessage: "⚠️ 완료 커밋 실패 — 수동 확인 필요"}'; exit 0
  fi
  if git push -q origin "$branch" 2>/dev/null; then
    jq -nc --arg h "$head" --arg b "$branch" --arg p "$progress" \
      '{systemMessage: ("✅ " + $h + " 완료 — 전체 커밋·푸시 (origin/" + $b + ", 진행 " + $p + ")")}'
  else
    jq -nc --arg h "$head" '{systemMessage: ("✅ " + $h + " 완료 — 커밋됨. push 실패, 수동 push 필요")}'
  fi
  exit 0
fi

# 일반 백로그 변경 — 백로그와 태스크 문서만 커밋 (push 안 함)
git add backlog.json docs/tasks >/dev/null 2>&1
if git commit -q -m "chore(backlog): 상태 동기화 [hook]

진행: ${progress}

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- backlog.json docs/tasks 2>/dev/null; then
  jq -nc --arg p "$progress" '{systemMessage: ("📋 백로그 자동 커밋 (진행 " + $p + ")")}'
fi
exit 0
