# 사장님 비밀번호 초기화

설계상 "비밀번호 찾기" 화면은 없다(설계.md §2). 사장님이 비밀번호를 잊으면
개발자가 이 스크립트로 초기화한다.

## 실행

```bash
npm run reset-owner-password
```

실행하면 `새 비밀번호 (4자 이상):` 프롬프트가 뜬다. 그 자리에서 입력한다 —
명령어 자체에는 비밀번호가 없으므로 bash/zsh 히스토리(`~/.bash_history`)에도
PowerShell 히스토리(`ConsoleHost_history.txt`)에도 안 남는다.

- **`NEW_OWNER_PASSWORD="새비밀번호" npm run reset-owner-password`처럼
  커맨드에 붙여 넘기지 않는다.** `VAR=값 명령` 형태는 bash/zsh가, PowerShell의
  `$env:NEW_OWNER_PASSWORD="값"`도 PSReadLine이 히스토리 파일에 그대로
  남긴다 — "환경변수니까 안전하다"가 아니라 "명령줄에 값이 한 번이라도
  등장하면 히스토리에 남는다"가 맞는 규칙이다. CI처럼 프롬프트에 입력할
  사람이 없을 때만 이 환경변수를 예외적으로 쓰고, 그 경우 실행 후 CI 잡의
  로그와 히스토리를 직접 정리한다.
- 4자 미만이면 스크립트가 거부한다.
- 실행하면 `factory_settings.owner_password_hash`가 새 해시로 바뀌고,
  로그인 실패 횟수·잠금도 함께 풀린다(잠긴 상태에서 초기화하는 경우가
  많아서).
- `audit_logs`에 `action: 'owner_password_reset_by_script'`로 기록된다.
  누가 초기화했는지(개인 식별)는 남기지 않는다(§26).

## 주의

- Supabase 대시보드에서 `factory_settings` 행을 직접 고치지 않는다 —
  비밀번호는 항상 이 스크립트가 만드는 `salt:hex` 형식의 scrypt 해시여야
  한다. 평문이나 다른 형식을 넣으면 로그인 자체가 막힌다
  (`lib/auth/password.ts`의 `verifyPassword`가 형식이 안 맞으면 항상 거부).
- 초기화 후 사장님에게 새 비밀번호를 안전한 방법(전화 등)으로 전달하고,
  로그인 후 `/owner-home/password`에서 원하는 비밀번호로 다시 바꾸게 한다.
