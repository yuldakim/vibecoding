import { createServiceClient } from "@/lib/supabase/server";
import { selectStaffAccount } from "./actions";

// 직원 목록은 요청마다 새로 조회해야 한다 — 정적 프리렌더되면 배포 시점
// 계정 목록이 굳어버려 이후 추가·중지된 계정이 반영되지 않는다.
export const dynamic = "force-dynamic";

export default async function StaffSelectPage() {
  const supabase = createServiceClient();
  const { data: accounts } = await supabase
    .from("staff_accounts")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">직원 선택</h1>
      {!accounts?.length && (
        <p className="text-lg text-zinc-600">등록된 직원 계정이 없습니다. 사장님께 문의하세요.</p>
      )}
      <div className="flex w-full max-w-sm flex-col gap-3">
        {accounts?.map((account) => (
          <form key={account.id} action={selectStaffAccount}>
            <input type="hidden" name="staffId" value={account.id} />
            <button
              type="submit"
              className="h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
            >
              {account.name}
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
