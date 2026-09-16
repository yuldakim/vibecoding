import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/db/like";
import { formatKstDate } from "@/lib/date/kst";
import { sortByFavoriteThenRecency } from "@/lib/items/recency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Th, Td } from "@/components/ui/table";
import { addItem, toggleItemFavorite, toggleItemHidden } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  duplicate: "이미 같은 이름의 품목이 있습니다.",
  duplicate_hidden: "이미 같은 이름의 숨긴 품목이 있습니다. '숨긴 품목도 보기'를 눌러 복구하세요.",
  save_failed: "저장하지 못했습니다. 잠시 후 다시 시도하세요.",
};

type SearchParams = { clientId?: string; q?: string; showHidden?: string; error?: string };

export default async function OwnerItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const { clientId, q, showHidden, error: errorCode } = await searchParams;
  const supabase = createServiceClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const parsedClientId = clientId ? Number(clientId) : NaN;
  const selectedClientId = Number.isInteger(parsedClientId) ? parsedClientId : clients?.[0]?.id;

  let items: {
    id: number;
    name: string;
    is_favorite: boolean;
    is_hidden: boolean;
    last_used_at: string | null;
  }[] = [];
  let itemsError = false;
  if (selectedClientId) {
    let query = supabase
      .from("items")
      .select("id, name, is_favorite, is_hidden, last_used_at")
      .eq("client_id", selectedClientId)
      .is("merged_into_item_id", null);
    if (!showHidden) query = query.eq("is_hidden", false);
    if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
    const { data, error } = await query;
    items = data ? sortByFavoriteThenRecency(data) : [];
    itemsError = !!error;
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">품목 관리</h1>
      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="clientId" className="text-lg">
            원청
          </label>
          <select
            id="clientId"
            name="clientId"
            defaultValue={selectedClientId}
            className="h-14 rounded-lg border border-border px-4 text-lg"
          >
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Input id="q" name="q" label="품목명 검색" defaultValue={q} placeholder="예: 차렵이불" />
        <label className="flex h-14 items-center gap-2 text-lg">
          <input type="checkbox" name="showHidden" value="1" defaultChecked={!!showHidden} className="h-5 w-5" />
          숨긴 품목도 보기
        </label>
        <Button type="submit">필터 적용</Button>
      </form>

      {!clients?.length && <p className="text-lg text-zinc-600">등록된 원청이 없습니다.</p>}

      {errorCode && (
        <p className="text-lg text-danger">{ERROR_MESSAGES[errorCode] ?? "처리하지 못했습니다."}</p>
      )}

      {selectedClientId && (
        <form action={addItem} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="clientId" value={selectedClientId} />
          <Input id="name" name="name" label="새 품목명" placeholder="예: 메이퀸 꽃 차렵이불" />
          <Button type="submit">추가</Button>
          <span className="text-lg text-zinc-600">
            이름을 완전히 바꾸려면(이력 보존) 별도 품목명 변경 기능을 쓴다 — 여기는 신규 등록·오타 수정용.
          </span>
        </form>
      )}

      {selectedClientId && (
        <Table>
          <thead>
            <tr>
              <Th>품목명</Th>
              <Th>즐겨찾기</Th>
              <Th>최근 사용</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.name}</Td>
                <Td>
                  <form action={toggleItemFavorite.bind(null, item.id, selectedClientId, !item.is_favorite)}>
                    <Button type="submit" variant="secondary" aria-label={item.is_favorite ? "즐겨찾기 해제" : "즐겨찾기 지정"}>
                      {item.is_favorite ? "★" : "☆"}
                    </Button>
                  </form>
                </Td>
                <Td>{item.last_used_at ? formatKstDate(item.last_used_at) : "-"}</Td>
                <Td>
                  <form action={toggleItemHidden.bind(null, item.id, selectedClientId, !item.is_hidden)}>
                    <Button type="submit" variant={item.is_hidden ? "secondary" : "danger"}>
                      {item.is_hidden ? "복구" : "숨기기"}
                    </Button>
                  </form>
                </Td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <Td>{itemsError ? "목록을 불러오지 못했습니다." : "조건에 맞는 품목이 없습니다."}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
    </main>
  );
}
