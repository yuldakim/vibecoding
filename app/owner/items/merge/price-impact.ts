import type { createServiceClient } from "@/lib/supabase/server";

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
      const [{ data: sourcePrice }, { data: finalPrice }] = await Promise.all([
        supabase
          .from("monthly_prices")
          .select("unit_price")
          .eq("client_id", clientId)
          .eq("item_id", source.id)
          .eq("size_id", sizeId)
          .eq("price_month", month)
          .maybeSingle(),
        supabase
          .from("monthly_prices")
          .select("unit_price")
          .eq("client_id", clientId)
          .eq("item_id", finalItemId)
          .eq("size_id", sizeId)
          .eq("price_month", month)
          .maybeSingle(),
      ]);
      const sp = sourcePrice?.unit_price ?? null;
      const fp = finalPrice?.unit_price ?? null;
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
