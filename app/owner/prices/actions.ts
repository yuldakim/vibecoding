"use server";

import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

export type UpsertPriceResult = { ok: true } | { ok: false; error: string };

/** 단가는 정수(원)만 허용한다. 빈 문자열은 "미정"(null)으로 되돌리는 것으로 취급한다. */
function parsePrice(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

export async function upsertMonthlyPrice(
  clientId: number,
  itemId: number,
  sizeId: number,
  priceMonth: string,
  rawValue: string,
): Promise<UpsertPriceResult> {
  await requireRole("owner");

  const parsed = parsePrice(rawValue);
  if (parsed === undefined) return { ok: false, error: "정수(원)만 입력하세요." };

  const supabase = createServiceClient();
  const { data: existing, error: selErr } = await supabase
    .from("monthly_prices")
    .select("id, unit_price")
    .eq("client_id", clientId)
    .eq("item_id", itemId)
    .eq("size_id", sizeId)
    .eq("price_month", priceMonth)
    .maybeSingle();
  if (selErr) return { ok: false, error: "조회 중 문제가 발생했습니다." };

  const oldPrice = existing?.unit_price ?? null;
  // 값이 실제로 안 바뀌면 아무것도 쓰지 않는다 — 안 그러면 셀에 포커스만
  // 갔다 나와도 유령 행과 거짓 변경이력이 쌓이고, T-053 복사가 "이미 값이
  // 있다"고 잘못 판단해 건너뛰게 된다.
  if (oldPrice === parsed) return { ok: true };

  let monthlyPriceId: number;

  if (existing) {
    const { error } = await supabase
      .from("monthly_prices")
      .update({ unit_price: parsed, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: "저장에 실패했습니다." };
    monthlyPriceId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("monthly_prices")
      .insert({ client_id: clientId, item_id: itemId, size_id: sizeId, price_month: priceMonth, unit_price: parsed })
      .select("id")
      .single();
    if (error || !inserted) return { ok: false, error: "저장에 실패했습니다." };
    monthlyPriceId = inserted.id;
  }

  // 변경 전/후/시각 기록 — §11. 실패해도 단가 저장 자체는 이미 끝났으니 조용히 넘어간다.
  await supabase.from("price_change_history").insert({
    monthly_price_id: monthlyPriceId,
    old_price: oldPrice,
    new_price: parsed,
    changed_by_role: "owner",
  });

  return { ok: true };
}
