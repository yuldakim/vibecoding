import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/db/like";
import { formatKstDate } from "@/lib/date/kst";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Th, Td } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type SearchParams = { clientId?: string; q?: string; showHidden?: string };

export default async function OwnerItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const { clientId, q, showHidden } = await searchParams;
  const supabase = createServiceClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const parsedClientId = clientId ? Number(clientId) : NaN;
  const selectedClientId = Number.isInteger(parsedClientId) ? parsedClientId : clients?.[0]?.id;

  let items: { id: number; name: string; is_favorite: boolean; last_used_at: string | null }[] = [];
  let itemsError = false;
  if (selectedClientId) {
    let query = supabase
      .from("items")
      .select("id, name, is_favorite, last_used_at")
      .eq("client_id", selectedClientId)
      .is("merged_into_item_id", null);
    if (!showHidden) query = query.eq("is_hidden", false);
    if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
    const { data, error } = await query.order("is_favorite", { ascending: false }).order("name");
    items = data ?? [];
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

      {selectedClientId && (
        <Table>
          <thead>
            <tr>
              <Th>품목명</Th>
              <Th>즐겨찾기</Th>
              <Th>최근 사용</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.name}</Td>
                <Td>{item.is_favorite ? "★" : ""}</Td>
                <Td>{item.last_used_at ? formatKstDate(item.last_used_at) : "-"}</Td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <Td>{itemsError ? "목록을 불러오지 못했습니다." : "조건에 맞는 품목이 없습니다."}</Td>
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
