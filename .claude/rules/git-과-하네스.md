# Git과 하네스

## 브랜치

- 작업은 **`dev`** 에서 한다. `main`에서 직접 작업하지 않는다.
- 세션을 시작하면 hook이 현재 브랜치를 알린다. `main`이면 옮기라고 안내한다.
- **브랜치는 사용자 승인 없이 바꾸지 않는다.** 작업 중인 변경이 있을 수 있다.
- 백로그 `done` 자동 push는 **현재 브랜치**로 나간다. `dev`에 있으면 `origin/dev`다.

## 커밋

- `git add`는 **의도한 파일·경로를 지정**한다. 습관적으로 `-A`를 쓰지 않는다.
  (예외: `done` 자동 커밋 hook은 작업 내역 전체를 담는 것이 목적이라 `-A`를 쓴다)
- 커밋·push는 **사용자가 요청할 때** 한다. 다만 아래 두 hook은 자동이다.
- 비밀값이 커밋에 들어가지 않는지 스테이징 후 확인한다.

## 자동으로 도는 hook

| 파일 | 이벤트 | 하는 일 |
| --- | --- | --- |
| `session-branch.sh` | SessionStart | 브랜치 표시, `main`이면 `dev` 안내 |
| `backlog-guard.sh` | PreToolUse | `backlog.json` 직접 접근 차단 + CLI 안내 |
| `task-claimed-guard.sh` | PreToolUse | `in_progress` 작업이 없으면 산출물 수정 차단 |
| `backlog-sync.sh` | PostToolUse/Bash | 백로그 변경 시 자동 커밋, `done`이면 전체 커밋+push |
| `code-size-check.mjs` | PostToolUse/Write·Edit | 줄 수 한도 (85% 경고 / 초과 차단) |
| `lint-file.sh` | PostToolUse/Write·Edit | 방금 고친 파일만 lint |
| `build-check.sh` | Stop | 턴 끝에 build |

배선은 `.claude/settings.json`에 있다.

### done 자동 커밋이 담는 것

작업이 `done`이 되면 `git add -A`로 **작업 트리 전체**를 한 커밋에 담고
push한다. "작업 하나가 끝났다"는 신호이므로 그 작업으로 만든 코드까지 함께
올리는 것이 목적이다.

→ `done`으로 바꾸기 **전에** 작업 트리에 관련 없는 파일이 없는지 확인한다.

done 판정은 CLI 호출을 가로채는 대신 HEAD와 작업 트리의 done 목록을 비교해서
한다. 어떤 경로로 바뀌었든 잡히고, 같은 작업을 두 번 올리지 않는다.

## 막혔을 때

hook이 막는 것은 고장이 아니라 규칙이다. 메시지에 이유와 해결 방법이 함께 나온다.

- 우회하려 하지 않는다. 특히 줄 수 한도를 넘기려고 파일을 억지로 나누거나
  검사를 피하는 경로를 찾지 않는다.
- 규칙 자체가 상황에 안 맞는다고 판단되면 **사용자에게 조정을 요청한다.**
- hook을 고쳐야 한다면 `.claude/hooks/`의 스크립트와 `.claude/settings.json`을
  함께 본다. 규칙(문서)과 강제 장치(hook)는 쌍이다 — 하나만 바꾸지 않는다.
