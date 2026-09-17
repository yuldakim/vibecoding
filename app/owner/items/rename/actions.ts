"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

function backTo(itemId: number, clientId: number, query: string, newName?: string): never {
  const params = new URLSearchParams(query);
  if (newName) params.set("retry_newName", newName);
  redirect(`/owner/items/rename?itemId=${itemId}&clientId=${clientId}&${params.toString()}`);
}

/**
 * 품목 id는 그대로 두고 이름만 바꾼다. 옛 이름은 item_aliases에 남겨서
 * 검색에서 계속 걸리게 한다. invoice_lines.item_name_snapshot은 절대
 * 건드리지 않는다 — 그게 §4의 핵심(과거 송장은 당시 이름 그대로).
 */
export async function renameItem(formData: FormData) {
  await requireRole("owner");

  const itemId = Number(formData.get("itemId"));
  const clientId = Number(formData.get("clientId"));
  const newName = String(formData.get("newName") ?? "").trim();

  if (!Number.isInteger(itemId) || !Number.isInteger(clientId)) redirect("/owner/items");
  if (!newName) backTo(itemId, clientId, "error=missing", newName);

  const supabase = createServiceClient();
  const { data: current } = await supabase.from("items").select("id, name").eq("id", itemId).maybeSingle();
  if (!current) redirect("/owner/items");
  if (current.name === newName) backTo(itemId, clientId, "error=same_name", newName);

  const { data: dup } = await supabase
    .from("items")
    .select("id")
    .eq("client_id", clientId)
    .is("merged_into_item_id", null)
    .eq("name", newName)
    .neq("id", itemId)
    .maybeSingle();
  if (dup) backTo(itemId, clientId, "error=duplicate", newName);

  const { error: aliasError } = await supabase
    .from("item_aliases")
    .insert({ item_id: itemId, alias_name: current.name });
  if (aliasError) backTo(itemId, clientId, "error=save_failed", newName);

  const { error: updateError } = await supabase.from("items").update({ name: newName }).eq("id", itemId);
  if (updateError) {
    // update가 실패하면 이름은 안 바뀌었으니, 방금 넣은 별칭도 되돌린다 —
    // 안 그러면 "바뀐 적 없는 이름 변경"이 이력에 남는다.
    await supabase.from("item_aliases").delete().eq("item_id", itemId).eq("alias_name", current.name);
    backTo(itemId, clientId, "error=save_failed", newName);
  }

  revalidatePath("/owner/items");
  redirect(`/owner/items?clientId=${clientId}`);
}
