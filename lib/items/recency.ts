import { createServiceClient } from "../supabase/server.ts";

type RecencyItem = { is_favorite: boolean; last_used_at: string | null; name: string };

/** 즐겨찾기 > 최근 사용(내림차순) > 이름순으로 정렬하는 순수 함수. */
export function sortByFavoriteThenRecency<T extends RecencyItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    if (a.last_used_at !== b.last_used_at) {
      if (a.last_used_at === null) return 1;
      if (b.last_used_at === null) return -1;
      return a.last_used_at > b.last_used_at ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "ko");
  });
}

/** 송장 확정 시(T-044) 호출한다 — 지금은 호출부가 없다. */
export async function touchItemLastUsed(itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) return;
  const supabase = createServiceClient();
  await supabase
    .from("items")
    .update({ last_used_at: new Date().toISOString() })
    .in("id", itemIds);
}
