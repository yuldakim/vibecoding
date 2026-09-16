// 실행: node --experimental-strip-types lib/items/search.check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { searchItems } from "./search.ts";
import { createServiceClient } from "../supabase/server.ts";

for (const line of readFileSync(".env.local", "utf8").trim().split("\n")) {
  const [k, v] = line.split("=", 2);
  if (k && v !== undefined) process.env[k] = v;
}

const supabase = createServiceClient();

// --- 테스트 데이터 세팅 ---
const { data: client } = await supabase
  .from("clients")
  .insert({
    name: "__search_check_client__",
    contact_name: "x",
    contact_email: "x@x.com",
    phone: "0",
    address: "x",
    auto_send_day: 1,
    owner_review_day: 1,
  })
  .select("id")
  .single();
const clientId = client!.id;

const { data: oldItem } = await supabase
  .from("items")
  .insert({ client_id: clientId, name: "옛이름품목" })
  .select("id")
  .single();
const { data: newItem } = await supabase
  .from("items")
  .insert({ client_id: clientId, name: "새이름품목" })
  .select("id")
  .single();
await supabase.from("items").update({ merged_into_item_id: newItem!.id }).eq("id", oldItem!.id);
await supabase.from("item_aliases").insert({ item_id: oldItem!.id, alias_name: "옛이름품목" });

try {
  const byOldName = await searchItems(clientId, "옛이름품목");
  assert.equal(byOldName.length, 1, "옛 이름 검색은 결과 1건이어야 함");
  assert.equal(byOldName[0].id, newItem!.id, "옛 이름으로 검색해도 최종(합쳐진) 품목이 나와야 함");
  assert.equal(byOldName[0].matchedAlias, "옛이름품목", "매치된 별칭이 표시돼야 함");

  const byNewName = await searchItems(clientId, "새이름품목");
  assert.equal(byNewName.length, 1, "현재 이름 검색은 결과 1건");
  assert.equal(byNewName[0].id, newItem!.id);
  assert.equal(byNewName[0].matchedAlias, null, "현재 이름 매치는 별칭이 없어야 함");

  console.log("search.check.ts: 전부 통과");
} finally {
  await supabase.from("item_aliases").delete().eq("item_id", oldItem!.id);
  await supabase.from("items").delete().in("id", [oldItem!.id, newItem!.id]);
  await supabase.from("clients").delete().eq("id", clientId);
}
