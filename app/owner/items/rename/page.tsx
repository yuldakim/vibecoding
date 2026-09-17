import { notFound, redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { renameItem } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "새 이름을 입력하세요.",
  same_name: "지금 이름과 같습니다.",
  duplicate: "이미 같은 이름의 품목이 있습니다.",
  save_failed: "저장하지 못했습니다. 잠시 후 다시 시도하세요.",
};

export default async function RenameItemPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string; clientId?: string; error?: string; retry_newName?: string }>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const sp = await searchParams;
  const itemId = Number(sp.itemId);
  const clientId = Number(sp.clientId);
  if (!Number.isInteger(itemId) || !Number.isInteger(clientId)) notFound();

  const supabase = createServiceClient();
  const { data: item } = await supabase.from("items").select("id, name").eq("id", itemId).maybeSingle();
  if (!item) notFound();

  // "쓰인 송장 건수"는 줄 수가 아니라 확정된(취소·임시 제외) 송장의 개수다 —
  // 같은 송장에 이 품목이 여러 줄로 들어가면 줄 수로 세면 부풀려진다(§6).
  const { data: usageLines } = await supabase
    .from("invoice_lines")
    .select("invoice_id, invoices(status)")
    .eq("item_id", itemId);
  const usageCount = new Set(
    (usageLines ?? [])
      .filter((l) => (l.invoices as { status?: string } | null)?.status === "confirmed")
      .map((l) => l.invoice_id),
  ).size;

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">품목명 변경</h1>
      <p className="text-lg">현재 이름: {item.name}</p>
      <p className="text-lg text-zinc-600">
        이 품목은 과거 송장 {usageCount ?? 0}건에 쓰였습니다. 이름을 바꿔도 그 송장들에는 당시 이름이 그대로
        남고, 정산서에는 새 이름만 표시됩니다.
      </p>

      {sp.error && (
        <p className="text-lg text-danger">{ERROR_MESSAGES[sp.error] ?? "처리하지 못했습니다."}</p>
      )}

      <form action={renameItem} className="flex max-w-sm flex-col gap-4">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="clientId" value={clientId} />
        <Input
          id="newName"
          name="newName"
          label="새 이름"
          placeholder={item.name}
          defaultValue={sp.error ? sp.retry_newName ?? "" : ""}
        />
        <Button type="submit">이름 변경</Button>
      </form>
    </main>
  );
}
