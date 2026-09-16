import { createServiceClient } from "../supabase/server.ts";
import { escapeLike } from "../db/like.ts";

export type ItemSearchResult = { id: number; name: string; matchedAlias: string | null };

/**
 * 현재 품목명과 이전 이름(item_aliases) 양쪽에서 검색한다. 별칭이 매치되면
 * final_item_id()로 합치기 체인을 따라가 최종 품목을 반환한다 — 새 이름으로
 * 검색해도 옛 이름 송장이 함께 조회돼야 한다는 요구(§4)를 만족시킨다.
 */
export async function searchItems(clientId: number, query: string): Promise<ItemSearchResult[]> {
  const q = escapeLike(query.trim());
  if (!q) return [];
  const supabase = createServiceClient();
  const pattern = `%${q}%`;
  const results = new Map<number, ItemSearchResult>();

  const { data: nameMatches } = await supabase
    .from("items")
    .select("id, name")
    .eq("client_id", clientId)
    .is("merged_into_item_id", null)
    .ilike("name", pattern);
  for (const item of nameMatches ?? []) {
    results.set(item.id, { id: item.id, name: item.name, matchedAlias: null });
  }

  // 별칭 검색 범위를 이 원청의 품목으로 좁힌다(합쳐진 품목 포함 — 별칭은
  // 합쳐지기 전 품목에 달려 있을 수 있다).
  const { data: clientItems } = await supabase.from("items").select("id").eq("client_id", clientId);
  const idList = (clientItems ?? []).map((i) => i.id);
  if (idList.length === 0) return [...results.values()];

  const { data: aliasMatches } = await supabase
    .from("item_aliases")
    .select("alias_name, item_id")
    .in("item_id", idList)
    .ilike("alias_name", pattern);

  for (const alias of aliasMatches ?? []) {
    const finalId = await resolveFinalItemId(supabase, alias.item_id);
    if (results.has(finalId)) continue;
    const { data: finalItem } = await supabase.from("items").select("id, name").eq("id", finalId).single();
    if (finalItem) {
      results.set(finalId, { id: finalItem.id, name: finalItem.name, matchedAlias: alias.alias_name });
    }
  }

  return [...results.values()];
}

async function resolveFinalItemId(
  supabase: ReturnType<typeof createServiceClient>,
  itemId: number,
): Promise<number> {
  const { data } = await supabase.rpc("final_item_id", { p_item_id: itemId });
  return (data as number | null) ?? itemId;
}
