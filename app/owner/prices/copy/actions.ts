"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

const MONTH_RE = /^\d{4}-\d{2}$/;

function backTo(clientId: number, fromMonth: string, toMonth: string, query: string): never {
  redirect(
    `/owner/prices/copy?clientId=${clientId}&fromMonth=${fromMonth}&toMonth=${toMonth}&${query}`,
  );
}

export async function copyMonthlyPrices(formData: FormData) {
  await requireRole("owner");

  const clientId = Number(formData.get("clientId"));
  const fromMonth = String(formData.get("fromMonth") ?? "");
  const toMonth = String(formData.get("toMonth") ?? "");
  const overwriteExisting = formData.get("overwriteExisting") === "1";

  if (!Number.isInteger(clientId) || !MONTH_RE.test(fromMonth) || !MONTH_RE.test(toMonth)) {
    redirect("/owner/prices/copy?error=same_month");
  }
  if (fromMonth === toMonth) backTo(clientId, fromMonth, toMonth, "error=same_month");

  const supabase = createServiceClient();
  const fromDate = `${fromMonth}-01`;
  const toDate = `${toMonth}-01`;

  const { data: sourceRows } = await supabase
    .from("monthly_prices")
    .select("item_id, size_id, unit_price")
    .eq("client_id", clientId)
    .eq("price_month", fromDate);

  if (!sourceRows?.length) backTo(clientId, fromMonth, toMonth, "error=no_source");

  const { data: targetRows } = await supabase
    .from("monthly_prices")
    .select("id, item_id, size_id, unit_price")
    .eq("client_id", clientId)
    .eq("price_month", toDate);
  const targetMap = new Map((targetRows ?? []).map((r) => [`${r.item_id}-${r.size_id}`, r]));

  let created = 0;
  let skipped = 0;
  let overwritten = 0;
  let failed = 0;

  for (const row of sourceRows) {
    const existing = targetMap.get(`${row.item_id}-${row.size_id}`);
    if (existing) {
      // 기존 입력값을 실수로 덮어쓰지 않는다 — overwriteExisting이 명시적으로
      // true일 때만, 값이 실제로 다를 때만, 그리고 원본이 미정(null)이라서
      // 이미 정해진 값을 지우는 경우가 아닐 때만 이력을 남기고 바꾼다.
      const wouldEraseRealPrice = row.unit_price === null && existing.unit_price !== null;
      if (!overwriteExisting || existing.unit_price === row.unit_price || wouldEraseRealPrice) {
        skipped++;
        continue;
      }
      const { error } = await supabase
        .from("monthly_prices")
        .update({ unit_price: row.unit_price, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) {
        failed++;
        continue;
      }
      await supabase.from("price_change_history").insert({
        monthly_price_id: existing.id,
        old_price: existing.unit_price,
        new_price: row.unit_price,
        changed_by_role: "owner",
      });
      overwritten++;
    } else {
      // 미정(unit_price: null)이었던 것도 그대로 미정으로 복사한다(§10).
      const { error } = await supabase.from("monthly_prices").insert({
        client_id: clientId,
        item_id: row.item_id,
        size_id: row.size_id,
        price_month: toDate,
        unit_price: row.unit_price,
      });
      if (error) {
        failed++;
        continue;
      }
      created++;
    }
  }

  backTo(
    clientId,
    fromMonth,
    toMonth,
    `created=${created}&skipped=${skipped}&overwritten=${overwritten}&failed=${failed}`,
  );
}
