import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changeOwnerPassword } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  current_wrong: "현재 비밀번호가 틀렸습니다.",
  next_invalid: "새 비밀번호는 4자 이상이어야 하고, 확인란과 같아야 합니다.",
  save_failed: "저장에 실패했습니다. 잠시 후 다시 시도하세요.",
};

export default async function OwnerPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">비밀번호 변경</h1>
      {message && <p className="text-lg text-danger">{message}</p>}
      <form action={changeOwnerPassword} className="flex w-full max-w-sm flex-col gap-4">
        <Input id="current" name="current" type="password" autoComplete="current-password" label="현재 비밀번호" />
        <Input id="next" name="next" type="password" autoComplete="new-password" label="새 비밀번호" />
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" label="새 비밀번호 확인" />
        <Button type="submit">비밀번호 바꾸기</Button>
      </form>
    </main>
  );
}
