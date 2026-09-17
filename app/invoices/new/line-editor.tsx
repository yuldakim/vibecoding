import { createServiceClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/db/like";
import { sortByFavoriteThenRecency } from "@/lib/items/recency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  clientId: number;
  q: string;
  itemQuery: string;
  lineItemIds: number[];
};

const MAX_LINES = 20;

/** 검색·추가·삭제 전부 GET 폼이라 클라이언트 JS 없이도 동작한다. 현재 줄
 *  목록(lineItemIds)을 숨은 필드로 그대로 실어 나른다 — 같은 품목이 여러
 *  줄에 들어갈 수 있어(§6, 비고가 다르면 별도 줄) id 집합이 아니라 순서
 *  있는 배열로 다룬다. */
export async function LineEditor({ clientId, q, itemQuery, lineItemIds }: Props) {
  const supabase = createServiceClient();

  let itemsQuery = supabase
    .from("items")
    .select("id, name, is_favorite, is_hidden, last_used_at")
    .eq("client_id", clientId)
    .is("merged_into_item_id", null)
    .eq("is_hidden", false);
  if (itemQuery) itemsQuery = itemsQuery.ilike("name", `%${escapeLike(itemQuery)}%`);
  const { data: itemRows, error: itemsError } = await itemsQuery;
  const items = itemRows ? sortByFavoriteThenRecency(itemRows) : [];

  // 줄에 담긴 품목도 이 원청 소속이고 숨김·합침이 안 된 상태인지 다시
  // 확인한다 — URL을 손으로 조작해 다른 원청 id를 끼워넣거나, 담아둔 뒤에
  // 사장님이 그 품목을 숨기거나 합쳐버린 경우 여기서 걸러진다. 걸러진
  // id는 줄 목록 자체에서 빠져서, 화면 표시와 이후 저장(T-041)이 항상
  // 같은 유효한 집합을 본다.
  const uniqueLineIds = [...new Set(lineItemIds)];
  const { data: lineItemRows, error: lineItemsError } =
    uniqueLineIds.length > 0
      ? await supabase
          .from("items")
          .select("id, name")
          .eq("client_id", clientId)
          .is("merged_into_item_id", null)
          .eq("is_hidden", false)
          .in("id", uniqueLineIds)
      : { data: [], error: null };
  const nameById = new Map((lineItemRows ?? []).map((i) => [i.id, i.name]));
  const validLineItemIds = lineItemsError ? lineItemIds : lineItemIds.filter((id) => nameById.has(id));
  const atMax = validLineItemIds.length >= MAX_LINES;

  function carryFields(excludeIndex?: number) {
    return (
      <>
        <input type="hidden" name="clientId" value={clientId} />
        {q && <input type="hidden" name="q" value={q} />}
        {itemQuery && <input type="hidden" name="itemQ" value={itemQuery} />}
        {validLineItemIds
          .filter((_, j) => j !== excludeIndex)
          .map((id, i) => (
            <input key={i} type="hidden" name="line" value={id} />
          ))}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">품목 추가</h2>
        <form method="get" className="flex flex-wrap items-end gap-3">
          {carryFields()}
          <Input id="itemQ" name="itemQ" label="품목명 검색" defaultValue={itemQuery} placeholder="예: 차렵이불" />
          <Button type="submit">검색</Button>
        </form>

        {itemsError && (
          <p className="text-lg text-danger">품목 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>
        )}
        {lineItemsError && (
          <p className="text-lg text-danger">
            추가된 품목 정보를 확인하지 못했습니다. 새로고침 후 다시 시도하세요.
          </p>
        )}
        {atMax && (
          <p className="text-lg text-danger">
            한 송장에는 최대 {MAX_LINES}줄까지 담을 수 있습니다. 줄을 지운 뒤 추가하세요.
          </p>
        )}
        {!itemsError && items.length === 0 && <p className="text-lg text-zinc-600">품목이 없습니다.</p>}
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <form key={item.id} method="get">
              {carryFields()}
              <div className="flex h-14 items-center justify-between rounded-lg border border-border px-4">
                <span className="text-lg">
                  {item.is_favorite ? "★ " : ""}
                  {item.name}
                </span>
                <Button type="submit" name="line" value={item.id} variant="secondary" disabled={atMax}>
                  추가
                </Button>
              </div>
            </form>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">추가된 품목 ({validLineItemIds.length}줄)</h2>
        {validLineItemIds.length === 0 && <p className="text-lg text-zinc-600">아직 추가된 품목이 없습니다.</p>}
        <ul className="flex flex-col gap-2">
          {validLineItemIds.map((id, i) => (
            <li key={i} className="flex h-14 items-center justify-between rounded-lg border border-border px-4">
              <span className="text-lg">{nameById.get(id)}</span>
              <form method="get">
                {carryFields(i)}
                <Button type="submit" variant="danger">
                  삭제
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
