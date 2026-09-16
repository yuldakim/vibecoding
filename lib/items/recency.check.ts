// 실행: node --experimental-strip-types lib/items/recency.check.ts
import assert from "node:assert/strict";
import { sortByFavoriteThenRecency, touchItemLastUsed } from "./recency.ts";
import { createServiceClient } from "../supabase/server.ts";

// 순수 정렬 함수 검증 (DB 불필요)
const items = [
  { name: "다", is_favorite: false, last_used_at: null },
  { name: "가", is_favorite: false, last_used_at: null },
  { name: "즐겨찾기품목", is_favorite: true, last_used_at: null },
  { name: "최근사용품목", is_favorite: false, last_used_at: "2026-09-10T00:00:00Z" },
  { name: "더최근사용품목", is_favorite: false, last_used_at: "2026-09-15T00:00:00Z" },
];
const sorted = sortByFavoriteThenRecency(items).map((i) => i.name);
assert.deepEqual(sorted, ["즐겨찾기품목", "더최근사용품목", "최근사용품목", "가", "다"], "즐겨찾기 > 최근순 > 이름순");

assert.deepEqual(
  sortByFavoriteThenRecency([{ name: "나", is_favorite: false, last_used_at: null }, { name: "가", is_favorite: false, last_used_at: null }]).map((i) => i.name),
  ["가", "나"],
  "최근 사용 없으면 이름순",
);

// touchItemLastUsed 실제 DB 검증
const supabase = createServiceClient();
const { data: client } = await supabase
  .from("clients")
  .insert({ name: "__recency_check__", contact_name: "x", contact_email: "x@x.com", phone: "0", address: "x", auto_send_day: 1, owner_review_day: 1 })
  .select("id")
  .single();
const clientId = client!.id;

try {
  const { data: item } = await supabase
    .from("items")
    .insert({ client_id: clientId, name: "__recency_check_item__" })
    .select("id, last_used_at")
    .single();
  assert.equal(item!.last_used_at, null, "시딩 직후엔 아직 null");

  await touchItemLastUsed([item!.id]);
  const { data: after } = await supabase.from("items").select("last_used_at").eq("id", item!.id).single();
  assert.notEqual(after!.last_used_at, null, "touchItemLastUsed 호출 후 채워져야 함");

  console.log("recency.check.ts: 전부 통과");
} finally {
  await supabase.from("items").delete().eq("client_id", clientId);
  await supabase.from("clients").delete().eq("id", clientId);
}
