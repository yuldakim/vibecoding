import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { StaffAccountList } from "./staff-account-list";

// 직원 목록은 요청마다 새로 조회해야 한다(T-013 /staff와 같은 이유 —
// 정적 프리렌더되면 배포 시점 계정 목록이 굳어버린다).
export const dynamic = "force-dynamic";

export default async function SelectPage() {
  const supabase = createServiceClient();
  const { data: accounts } = await supabase
    .from("staff_accounts")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-8">
      <h1 className="text-2xl font-bold">누구세요?</h1>

      <section className="flex w-full max-w-sm flex-col gap-3">
        <h2 className="text-lg text-zinc-600">직원</h2>
        {accounts?.length ? (
          <StaffAccountList accounts={accounts} />
        ) : (
          <p className="text-lg text-zinc-600">등록된 직원 계정이 없습니다. 사장님께 문의하세요.</p>
        )}
      </section>

      <section className="flex w-full max-w-sm flex-col gap-3 border-t border-border pt-8">
        <h2 className="text-lg text-zinc-600">사장님</h2>
        <Link
          href="/owner"
          className="flex h-14 w-full items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground hover:bg-black/5"
        >
          사장님 모드
        </Link>
      </section>
    </main>
  );
}
