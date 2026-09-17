import type { createServiceClient } from "@/lib/supabase/server";
import { resolveLinePrice } from "@/lib/prices/resolve";

export type PriceConflict = {
  itemName: string;
  sizeName: string;
  month: string;
  sourcePrice: number | null;
  finalPrice: number | null;
};

/**
 * 합치기 후(T-056) 확정 송장 줄은 최종 품목 단가로 재해석된다(§10, T-056
 * 완료 기준). 소스 품목이 확정 송장에 쓰인 달·사이즈 조합마다 소스 단가와
 * 최종 품목 단가를 비교해, 다르면 경고 대상으로 돌려준다 — 합치기 자체를
 * 막지는 않되 사장님이 금액이 바뀐다는 걸 보고 판단하게 한다.
 */
export async function findPriceConflicts(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: number,
  sources: { id: number; name: string }[],
  finalItemId: number,
): Promise<PriceConflict[]> {
  const { data: sizes } = await supabase.from("sizes").select("id, name");
  const sizeNameById = new Map((sizes ?? []).map((s) => [s.id, s.name]));

  const warnings: PriceConflict[] = [];
  for (const source of sources) {
    const { data: lines } = await supabase
      .from("invoice_lines")
      .select("size_id, invoices(status, delivery_date)")
      .eq("item_id", source.id);

    const usedPairs = new Set<string>();
    for (const line of lines ?? []) {
      const invoice = line.invoices as { status?: string; delivery_date?: string } | null;
      if (invoice?.status !== "confirmed" || !invoice.delivery_date) continue;
      usedPairs.add(`${line.size_id}:${invoice.delivery_date.slice(0, 7)}-01`);
    }

    for (const pair of usedPairs) {
      const [sizeIdStr, month] = pair.split(":");
      const sizeId = Number(sizeIdStr);
      // resolveLinePrice(T-056)를 그대로 써서 정산이 실제로 계산에 쓰는
      // 로직과 이 미리보기가 어긋나지 않게 한다.
      const [sourceResolved, finalResolved] = await Promise.all([
        resolveLinePrice(supabase, { clientId, itemId: source.id, sizeId, deliveryDate: month }),
        resolveLinePrice(supabase, { clientId, itemId: finalItemId, sizeId, deliveryDate: month }),
      ]);
      const sp = sourceResolved.unitPrice;
      const fp = finalResolved.unitPrice;
      if (sp !== fp) {
        warnings.push({
          itemName: source.name,
          sizeName: sizeNameById.get(sizeId) ?? `사이즈#${sizeId}`,
          month,
          sourcePrice: sp,
          finalPrice: fp,
        });
      }
    }
  }
  return warnings;
}
