import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addStaffAccount, toggleStaffAccountActive } from "./actions";

// 목록은 요청마다 새로 조회해야 한다 — 정적 프리렌더되면 배포 시점 계정
// 목록이 굳어버려 이후 추가·중지된 계정이 반영되지 않는다(T-013/T-088에서
// 같은 이유로 겪은 버그).
export const dynamic = "force-dynamic";

export default async function StaffSettingsPage() {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const supabase = createServiceClient();
  const { data: accounts } = await supabase
    .from("staff_accounts")
    .select("id, name, is_active")
    .order("is_active", { ascending: false })
    .order("name");

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-bold">직원 계정 관리</h1>

      <form action={addStaffAccount} className="flex w-full max-w-sm items-end gap-2">
        <Input id="name" name="name" label="새 직원 이름" className="flex-1" />
        <Button type="submit">추가</Button>
      </form>

      <ul className="flex w-full max-w-sm flex-col gap-2">
        {accounts?.map((account) => (
          <li
            key={account.id}
            className={`flex h-14 items-center justify-between rounded-lg border border-border px-4 text-lg ${
              account.is_active ? "" : "text-zinc-400"
            }`}
          >
            <span>
              {account.name}
              {!account.is_active && " (중지됨)"}
            </span>
            <form action={toggleStaffAccountActive.bind(null, account.id, !account.is_active)}>
              <Button type="submit" variant={account.is_active ? "danger" : "secondary"}>
                {account.is_active ? "중지" : "재사용"}
              </Button>
            </form>
          </li>
        ))}
        {!accounts?.length && <p className="text-lg text-zinc-600">등록된 직원 계정이 없습니다.</p>}
      </ul>
    </main>
  );
}
