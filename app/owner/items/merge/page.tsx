import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { findPriceConflicts } from "./price-impact";
import { MergePreview } from "./merge-preview";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  need_source: "합칠 품목을 1개 이상 고르세요.",
  final_not_selected: "최종 품목을 고르세요(합칠 목록에는 없어야 합니다).",
  save_failed: "합치기에 실패했습니다. 잠시 후 다시 시도하세요.",
};

type SearchParams = {
  clientId?: string;
  itemIds?: string | string[];
  finalItemId?: string;
  error?: string;
  mergedCount?: string;
  total?: string;
  merged?: string;
};

export default async function MergeItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const sp = await searchParams;
  const supabase = createServiceClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const parsedClientId = sp.clientId ? Number(sp.clientId) : NaN;
  const clientId = Number.isInteger(parsedClientId) ? parsedClientId : clients?.[0]?.id;

  let items: { id: number; name: string }[] = [];
  if (clientId) {
    // 숨긴 품목은 후보에서 뺀다 — 숨긴 품목을 최종으로 고르면 합쳐진 품목이
    // 품목 관리 기본 화면에서 통째로 사라져 보인다(adversarial-reviewer 지적).
    const { data } = await supabase
      .from("items")
      .select("id, name")
      .eq("client_id", clientId)
      .is("merged_into_item_id", null)
      .eq("is_hidden", false)
      .order("name");
    items = data ?? [];
  }

  const selectedIds = (Array.isArray(sp.itemIds) ? sp.itemIds : sp.itemIds ? [sp.itemIds] : [])
    .map(Number)
    .filter(Number.isInteger);
  const finalId = sp.finalItemId ? Number(sp.finalItemId) : NaN;
  const showPreview = selectedIds.length > 0 && Number.isInteger(finalId) && !selectedIds.includes(finalId);

  const usageByItem: { id: number; name: string; usageCount: number }[] = [];
  const selectedSources: { id: number; name: string }[] = [];
  if (showPreview) {
    for (const id of selectedIds) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      selectedSources.push(item);
      const { data: lines } = await supabase
        .from("invoice_lines")
        .select("invoice_id, invoices(status)")
        .eq("item_id", id);
      const count = new Set(
        (lines ?? [])
          .filter((l) => (l.invoices as { status?: string } | null)?.status === "confirmed")
          .map((l) => l.invoice_id),
      ).size;
      usageByItem.push({ id: item.id, name: item.name, usageCount: count });
    }
  }
  const finalItem = items.find((i) => i.id === finalId);
  const priceConflicts =
    showPreview && finalItem ? await findPriceConflicts(supabase, clientId!, selectedSources, finalId) : [];

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">품목 합치기</h1>
      <p className="text-lg text-zinc-600">
        같은 품목이 여러 이름으로 등록됐을 때 하나로 합칩니다. 과거 송장에는 당시 이름이 그대로 남고, 정산서에는
        최종 품목명만 표시됩니다. 합친 뒤에는 되돌릴 수 없습니다.
      </p>

      {sp.error === "save_failed" && Number(sp.mergedCount) > 0 && (
        <p className="text-lg text-danger">
          {sp.total}개 중 {sp.mergedCount}개만 합쳐지고 나머지는 실패했습니다. 목록을 다시 불러와 남은 품목을
          확인하세요.
        </p>
      )}
      {sp.error && !(Number(sp.mergedCount) > 0) && (
        <p className="text-lg text-danger">{ERROR_MESSAGES[sp.error] ?? "처리하지 못했습니다."}</p>
      )}
      {sp.merged === "1" && <p className="text-lg text-primary">합쳤습니다.</p>}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <select
          id="clientId"
          name="clientId"
          defaultValue={clientId}
          className="h-14 rounded-lg border border-border px-4 text-lg"
        >
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit">품목 불러오기</Button>
      </form>

      {clientId && items.length > 0 && (
        <form method="get" className="flex flex-col gap-4">
          <input type="hidden" name="clientId" value={clientId} />
          <table className="w-full max-w-lg text-lg">
            <thead>
              <tr className="text-left">
                <th className="pb-2">합칠 품목</th>
                <th className="pb-2">최종 품목</th>
                <th className="pb-2">품목명</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      name="itemIds"
                      value={item.id}
                      defaultChecked={selectedIds.includes(item.id)}
                      className="h-5 w-5"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="radio"
                      name="finalItemId"
                      value={item.id}
                      defaultChecked={finalId === item.id}
                      className="h-5 w-5"
                    />
                  </td>
                  <td className="py-2">{item.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="submit" className="max-w-xs">
            미리보기
          </Button>
        </form>
      )}

      {clientId && items.length === 0 && <p className="text-lg text-zinc-600">합칠 품목이 없습니다.</p>}

      {showPreview && finalItem && (
        <MergePreview
          clientId={clientId!}
          finalItem={finalItem}
          usageByItem={usageByItem}
          priceConflicts={priceConflicts}
          selectedIds={selectedIds}
        />
      )}
    </main>
  );
}
