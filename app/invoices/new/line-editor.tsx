import { createServiceClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/db/like";
import { sortByFavoriteThenRecency } from "@/lib/items/recency";
import { getSizes, type Size } from "@/lib/sizes/queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LineRowEditor } from "./line-row-editor";
import { parseLine, encodeLine, MAX_LINES, type ParsedLine } from "./line-codec";

type Props = {
  clientId: number;
  q: string;
  itemQuery: string;
  rawLines: string[];
};

/** 검색·추가·삭제 전부 GET 폼(클라이언트 JS 없이도 동작)이지만, 사이즈·수량
 *  편집만 클라이언트 컴포넌트(LineRowEditor)로 뺐다 — 즉시 합계 반영과
 *  SizeSelect 재사용을 위해서다. 같은 품목이 여러 줄에 들어갈 수 있어(§6,
 *  비고가 다르면 별도 줄) id 집합이 아니라 순서 있는 배열로 다룬다. */
export async function LineEditor({ clientId, q, itemQuery, rawLines }: Props) {
  const supabase = createServiceClient();

  let sizes: Size[] = [];
  let sizesError = false;
  try {
    sizes = await getSizes();
  } catch {
    sizesError = true;
  }
  if (sizesError) {
    return (
      <p className="text-lg text-danger">사이즈 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>
    );
  }
  const defaultSizeId = sizes[0]?.id ?? 0;
  const sizeIds = new Set(sizes.map((s) => s.id));

  let itemsQuery = supabase
    .from("items")
    .select("id, name, is_favorite, is_hidden, last_used_at")
    .eq("client_id", clientId)
    .is("merged_into_item_id", null)
    .eq("is_hidden", false);
  if (itemQuery) itemsQuery = itemsQuery.ilike("name", `%${escapeLike(itemQuery)}%`);
  const { data: itemRows, error: itemsError } = await itemsQuery;
  const items = itemRows ? sortByFavoriteThenRecency(itemRows) : [];

  // 형식이 맞고(정수 4개) 사이즈도 실재하는 값만 남긴다. sizeId는 itemId처럼
  // DB 존재 확인을 안 해도 sizes 목록과 직접 대조되므로 여기서 끝난다.
  // lineKey가 겹치면(URL 조작) 같은 React key를 가진 줄이 두 개 생겨 입력
  // 상태가 서로 섞이므로, 겹치는 뒤쪽은 버린다(먼저 나온 것만 유지).
  const seenLineKeys = new Set<number>();
  const formatValidLines = rawLines
    .map(parseLine)
    .filter((l): l is ParsedLine => l !== null && sizeIds.has(l.sizeId))
    .filter((l) => (seenLineKeys.has(l.lineKey) ? false : (seenLineKeys.add(l.lineKey), true)));
  const uniqueLineItemIds = [...new Set(formatValidLines.map((l) => l.itemId))];

  // 줄에 담긴 품목도 이 원청 소속이고 숨김·합침이 안 된 상태인지 다시
  // 확인한다 — URL을 손으로 조작해 다른 원청 id를 끼워넣거나, 담아둔 뒤에
  // 사장님이 그 품목을 숨기거나 합쳐버린 경우 여기서 걸러진다. 조회 자체가
  // 실패하면(일시적 DB 오류) 지금까지 담아온 줄을 지우지 않고 최대한 보존한다
  // — 안 그러면 오류 한 번에 최대 20줄이 통째로 날아간다.
  const { data: lineItemRows, error: lineItemsError } =
    uniqueLineItemIds.length > 0
      ? await supabase
          .from("items")
          .select("id, name")
          .eq("client_id", clientId)
          .is("merged_into_item_id", null)
          .eq("is_hidden", false)
          .in("id", uniqueLineItemIds)
      : { data: [], error: null };
  const nameById = new Map((lineItemRows ?? []).map((i) => [i.id, i.name]));
  const validLines = lineItemsError ? formatValidLines : formatValidLines.filter((l) => nameById.has(l.itemId));
  const atMax = validLines.length >= MAX_LINES;
  const totalQuantity = validLines.reduce((sum, l) => sum + l.quantity, 0);

  const baseParams = new URLSearchParams({ clientId: String(clientId) });
  if (q) baseParams.set("q", q);
  if (itemQuery) baseParams.set("itemQ", itemQuery);
  const baseUrl = `/invoices/new?${baseParams.toString()}`;
  // 새 줄의 lineKey는 지금 있는 줄들 중 가장 큰 값 + 1부터 시작한다 — Date.now()
  // 같은 비순수 함수를 렌더 중에 부르지 않고, 기존 데이터만으로 결정한다.
  const newLineKeyBase = validLines.reduce((max, l) => Math.max(max, l.lineKey), 0) + 1;

  function carryFields(extraLine?: ParsedLine) {
    return (
      <>
        <input type="hidden" name="clientId" value={clientId} />
        {q && <input type="hidden" name="q" value={q} />}
        {itemQuery && <input type="hidden" name="itemQ" value={itemQuery} />}
        {validLines.map((l, i) => (
          <input key={i} type="hidden" name="line" value={encodeLine(l)} />
        ))}
        {extraLine && <input type="hidden" name="line" value={encodeLine(extraLine)} />}
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
          {items.map((item, idx) => (
            <form key={item.id} method="get">
              {carryFields({ itemId: item.id, sizeId: defaultSizeId, quantity: 1, lineKey: newLineKeyBase + idx })}
              <div className="flex h-14 items-center justify-between rounded-lg border border-border px-4">
                <span className="text-lg">
                  {item.is_favorite ? "★ " : ""}
                  {item.name}
                </span>
                <Button type="submit" variant="secondary" disabled={atMax}>
                  추가
                </Button>
              </div>
            </form>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">
          추가된 품목 ({validLines.length}줄 · 전체 {totalQuantity}장)
        </h2>
        {validLines.length === 0 && <p className="text-lg text-zinc-600">아직 추가된 품목이 없습니다.</p>}
        <div className="flex flex-col gap-3">
          {validLines.map((line, i) => (
            <LineRowEditor
              // lineKey만으로 key를 잡으면 이 줄 자체의 사이즈·수량이 서버에서
              // 바뀌어도(다른 줄을 저장/삭제한 뒤 재렌더) 컴포넌트가 재사용돼
              // useState 초기값(마운트 시점 값)이 새 값과 어긋난 채로 남는다.
              // sizeId·quantity를 key에 포함시켜, 이 줄의 값이 실제로 바뀌면
              // 그때는 리마운트되어 항상 서버 값과 일치하게 한다.
              key={`${line.lineKey}:${line.sizeId}:${line.quantity}`}
              baseUrl={baseUrl}
              otherLines={validLines.filter((_, j) => j !== i).map(encodeLine)}
              index={i}
              itemId={line.itemId}
              itemName={nameById.get(line.itemId) ?? "(이름 확인 안 됨)"}
              sizeId={line.sizeId}
              quantity={line.quantity}
              lineKey={line.lineKey}
              sizes={sizes}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
