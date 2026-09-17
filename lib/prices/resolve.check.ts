// 실행: node --env-file=.env.local --experimental-strip-types lib/prices/resolve.check.ts
import assert from "node:assert/strict";
import { resolveLinePrice } from "./resolve.ts";
import { createServiceClient } from "../supabase/server.ts";

const supabase = createServiceClient();

const { data: client } = await supabase
  .from("clients")
  .insert({
    name: "__resolve_check__",
    contact_name: "x",
    contact_email: "x@x.com",
    phone: "0",
    address: "x",
    auto_send_day: 5,
    owner_review_day: 2,
  })
  .select("id")
  .single();
const clientId = client!.id;

try {
  const { data: itemA } = await supabase.from("items").insert({ client_id: clientId, name: "A" }).select("id").single();
  const { data: itemB } = await supabase.from("items").insert({ client_id: clientId, name: "B" }).select("id").single();
  const { data: sizes } = await supabase.from("sizes").select("id").limit(1);
  const sizeId = sizes![0].id;

  // A 7월 단가 12000, B 7월 단가 9000(자기 것), 8월 단가는 아무도 없음(미정)
  await supabase
    .from("monthly_prices")
    .insert({ client_id: clientId, item_id: itemA!.id, size_id: sizeId, price_month: "2026-07-01", unit_price: 12000 });
  await supabase
    .from("monthly_prices")
    .insert({ client_id: clientId, item_id: itemB!.id, size_id: sizeId, price_month: "2026-07-01", unit_price: 9000 });

  // 1) 그 달 기본 단가
  const julyPrice = await resolveLinePrice(supabase, {
    clientId,
    itemId: itemA!.id,
    sizeId,
    deliveryDate: "2026-07-15",
  });
  assert.equal(julyPrice.unitPrice, 12000, "7월 납품은 7월 단가를 써야 함");
  assert.equal(julyPrice.source, "monthly");

  // 2) 이월(§17) — 8월에 확정됐어도 실제 납품일이 7월이면 7월 단가
  const carryoverPrice = await resolveLinePrice(supabase, {
    clientId,
    itemId: itemA!.id,
    sizeId,
    deliveryDate: "2026-07-31",
  });
  assert.equal(carryoverPrice.unitPrice, 12000, "이월 송장은 실제 납품월(7월) 단가를 써야 함");

  // 3) 단가 행 자체가 없는 달 → 미정
  const augustPrice = await resolveLinePrice(supabase, {
    clientId,
    itemId: itemA!.id,
    sizeId,
    deliveryDate: "2026-08-05",
  });
  assert.equal(augustPrice.unitPrice, null, "단가 행이 없는 달은 미정(null)이어야 함");
  assert.equal(augustPrice.source, "undefined");

  // 3-1) 단가 행은 있는데 값이 null(지난달 복사·직접 비움으로 생기는 상태)도 같은 미정
  const { data: nullRow } = await supabase
    .from("monthly_prices")
    .insert({ client_id: clientId, item_id: itemA!.id, size_id: sizeId, price_month: "2026-09-01", unit_price: null })
    .select("id")
    .single();
  const explicitlyUndefinedPrice = await resolveLinePrice(supabase, {
    clientId,
    itemId: itemA!.id,
    sizeId,
    deliveryDate: "2026-09-10",
  });
  assert.equal(explicitlyUndefinedPrice.unitPrice, null, "값이 null인 단가 행도 미정으로 취급해야 함");
  assert.equal(explicitlyUndefinedPrice.source, "undefined", "행이 있어도 값이 null이면 source도 undefined여야 함");
  await supabase.from("monthly_prices").delete().eq("id", nullRow!.id);

  // 4) 줄 예외 단가 — 그 달 기본 단가(12000)가 있어도 예외 단가가 이긴다
  const exceptionPrice = await resolveLinePrice(supabase, {
    clientId,
    itemId: itemA!.id,
    sizeId,
    deliveryDate: "2026-07-15",
    lineExceptionPrice: 3500,
  });
  assert.equal(exceptionPrice.unitPrice, 3500, "줄 예외 단가가 기본 단가보다 우선해야 함");
  assert.equal(exceptionPrice.source, "line_exception");

  // 4-1) 정수가 아닌 예외 단가는 거부(금액은 정수만 — 코드-작성.md)
  await assert.rejects(
    () => resolveLinePrice(supabase, { clientId, itemId: itemA!.id, sizeId, deliveryDate: "2026-07-15", lineExceptionPrice: 3500.5 }),
    "소수점 예외 단가는 거부해야 함",
  );

  // 5) 합치기(T-033) — B를 A로 합치면 B의 자기 단가(9000)가 아니라 A(최종
  // 품목)의 단가(12000)가 나와야 한다. B에 자기 단가가 있는데도 안 쓰이는
  // 것까지 확인해야 "합쳐지기 전 단가로 새는" 회귀를 잡는다.
  await supabase.from("items").update({ merged_into_item_id: itemA!.id }).eq("id", itemB!.id);
  const mergedPrice = await resolveLinePrice(supabase, {
    clientId,
    itemId: itemB!.id,
    sizeId,
    deliveryDate: "2026-07-15",
  });
  assert.equal(mergedPrice.unitPrice, 12000, "합쳐진 품목은 최종 품목 단가로 계산돼야 하고 자기 옛 단가(9000)를 쓰면 안 됨");

  // 6) 날짜 형식이 어긋나면 조용히 엉뚱한 달을 계산하지 않고 예외를 던진다
  await assert.rejects(
    () => resolveLinePrice(supabase, { clientId, itemId: itemA!.id, sizeId, deliveryDate: "2026-07-31T15:30:00.000Z" }),
    "ISO 타임스탬프 형식은 거부해야 함(UTC 자정 경계에서 달이 밀리는 사고 방지)",
  );

  console.log("resolve.check.ts: 전부 통과");
} finally {
  await supabase.from("monthly_prices").delete().eq("client_id", clientId);
  await supabase.from("items").delete().eq("client_id", clientId);
  await supabase.from("clients").delete().eq("id", clientId);
}
