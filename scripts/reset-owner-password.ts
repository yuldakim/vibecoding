// 실행: npm run reset-owner-password  (프롬프트가 뜨면 새 비밀번호를 입력한다)
//
// NEW_OWNER_PASSWORD 환경변수로도 넘길 수 있지만 권장하지 않는다 —
// `VAR=값 명령`은 bash/zsh 히스토리에, PowerShell의 `$env:VAR="값"`도
// PSReadLine 히스토리 파일에 그대로 남는다. 대화형 프롬프트는 어느 쪽에도
// 안 남으므로 기본은 이쪽이다. CI처럼 대화형이 불가능할 때만 환경변수를 쓴다.
import { createInterface } from "node:readline/promises";
import { createServiceClient } from "../lib/supabase/server.ts";
import { hashPassword } from "../lib/auth/password.ts";

async function readNewPassword(): Promise<string> {
  if (process.env.NEW_OWNER_PASSWORD) return process.env.NEW_OWNER_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question("새 비밀번호 (4자 이상): ");
  } finally {
    rl.close();
  }
}

const newPassword = await readNewPassword();
if (!newPassword || newPassword.length < 4) {
  console.error("비밀번호는 4자 이상이어야 합니다.");
  process.exit(1);
}

const supabase = createServiceClient();

const { error: updateError } = await supabase
  .from("factory_settings")
  .update({
    owner_password_hash: hashPassword(newPassword),
    owner_login_fail_count: 0,
    owner_locked_until: null,
    updated_at: new Date().toISOString(),
  })
  .eq("id", 1);
if (updateError) {
  console.error("초기화 실패:", updateError.message);
  process.exit(1);
}

await supabase.from("audit_logs").insert({
  target_type: "factory_settings",
  target_id: 1,
  action: "owner_password_reset_by_script",
  before: { changed: false },
  after: { changed: true },
  actor_role: "owner",
});

console.log("사장님 비밀번호를 초기화했습니다. 로그인 실패 카운트·잠금도 해제했습니다.");
