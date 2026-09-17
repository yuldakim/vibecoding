"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

function backTo(clientId: number, query: string): never {
  redirect(`/owner/items/merge?clientId=${clientId}&${query}`);
}

/**
 * 합칠 품목들의 merged_into_item_id를 최종 품목으로 돌린다. 합쳐진 품목의
 * 원래 이름은 item_aliases에 남겨서 옛 이름 검색이 계속 걸리게 한다
 * (합쳐진 품목은 기본 이름 검색에서 merged_into_item_id 조건 때문에
 * 빠지므로, 안 남기면 그 이름으로는 찾을 방법이 없어진다). invoice_lines는
 * 절대 건드리지 않는다 — 과거 송장은 당시 이름 그대로(§4).
 */
export async function mergeItems(formData: FormData) {
  await requireRole("owner");

  const clientId = Number(formData.get("clientId"));
  const finalItemId = Number(formData.get("finalItemId"));
  const itemIds = formData.getAll("itemIds").map(Number).filter(Number.isInteger);

  if (!Number.isInteger(clientId) || !Number.isInteger(finalItemId)) redirect("/owner/items");
  if (itemIds.length === 0) backTo(clientId, "error=need_source");
  if (itemIds.includes(finalItemId)) backTo(clientId, "error=final_not_selected");

  const supabase = createServiceClient();

  // 넘어온 id들이 실제로 이 원청 소속이고 아직 안 합쳐진 품목인지 확인한다
  // — 다른 원청 품목이나 이미 합쳐진 품목이 섞여 들어오는 경로를 막는다.
  const { data: sources } = await supabase
    .from("items")
    .select("id, name")
    .in("id", itemIds)
    .eq("client_id", clientId)
    .is("merged_into_item_id", null);
  const { data: finalItem } = await supabase
    .from("items")
    .select("id")
    .eq("id", finalItemId)
    .eq("client_id", clientId)
    .is("merged_into_item_id", null)
    .maybeSingle();
  if (!finalItem || !sources || sources.length !== itemIds.length) backTo(clientId, "error=save_failed");

  // 여러 품목을 하나씩 순서대로 처리한다 — 트랜잭션이 아니라서 중간에
  // 실패하면 일부만 합쳐진 채로 멈출 수 있다. 그 경우 "실패했습니다"로만
  // 뭉뚱그리지 않고 몇 개가 이미 합쳐졌는지 사용자에게 알린다.
  let mergedCount = 0;
  for (const source of sources) {
    const { error: aliasError } = await supabase
      .from("item_aliases")
      .insert({ item_id: source.id, alias_name: source.name });
    if (aliasError) {
      backTo(clientId, `error=save_failed&mergedCount=${mergedCount}&total=${sources.length}`);
    }

    const { error: updateError } = await supabase
      .from("items")
      .update({ merged_into_item_id: finalItemId })
      .eq("id", source.id);
    if (updateError) {
      // 이름은 안 바뀌었으니 방금 넣은 별칭도 되돌린다(T-032와 같은 보정 패턴).
      await supabase.from("item_aliases").delete().eq("item_id", source.id).eq("alias_name", source.name);
      backTo(clientId, `error=save_failed&mergedCount=${mergedCount}&total=${sources.length}`);
    }
    mergedCount++;
  }

  revalidatePath("/owner/items");
  revalidatePath("/owner/items/merge");
  redirect(`/owner/items/merge?clientId=${clientId}&merged=1`);
}
