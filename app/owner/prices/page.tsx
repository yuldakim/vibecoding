import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/db/like";
import { toKstYearMonth } from "@/lib/date/kst";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Th, Td } from "@/components/ui/table";
import { PriceCell } from "./price-cell";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-\d{2}$/;

type SearchParams = { clientId?: string; month?: string; q?: string };

export default async function OwnerPricesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const sp = await searchParams;
  // 입력이 "YYYY-MM" 형식이 아니면(손타이핑, Firefox의 <input type="month">
  // 폴백 등) 조용히 "미정"으로 빠지지 않도록 여기서 기본값으로 되돌린다.
  const month = sp.month && MONTH_RE.test(sp.month) ? sp.month : toKstYearMonth(new Date());
  const priceMonth = `${month}-01`;
  const q = sp.q?.trim() ?? "";

  const supabase = createServiceClient();
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const parsedClientId = sp.clientId ? Number(sp.clientId) : NaN;
  const clientId = Number.isInteger(parsedClientId) ? parsedClientId : clients?.[0]?.id;

  let items: { id: number; name: string }[] = [];
  let sizes: { id: number; name: string }[] = [];
  const priceMap = new Map<string, number | null>();
  let loadError = false;

  if (clientId) {
    const [{ data: itemRows, error: e1 }, { data: sizeRows, error: e2 }, { data: priceRows, error: e3 }] =
      await Promise.all([
        supabase
          .from("items")
          .select("id, name")
          .eq("client_id", clientId)
          .is("merged_into_item_id", null)
          .ilike("name", `%${escapeLike(q)}%`)
          .order("name"),
        supabase.from("sizes").select("id, name").order("sort_order"),
        supabase
          .from("monthly_prices")
          .select("item_id, size_id, unit_price")
          .eq("client_id", clientId)
          .eq("price_month", priceMonth),
      ]);
    items = itemRows ?? [];
    sizes = sizeRows ?? [];
    for (const p of priceRows ?? []) priceMap.set(`${p.item_id}-${p.size_id}`, p.unit_price);
    loadError = !!(e1 || e2 || e3);
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">월별 단가 관리</h1>
      <p className="text-lg text-zinc-600">단가는 부가세 별도, 공급가액 기준입니다.</p>

      <form method="get" className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="clientId" className="text-lg">
            원청
          </label>
          <select
            id="clientId"
            name="clientId"
            defaultValue={clientId ?? ""}
            className="h-14 rounded-lg border border-border px-4 text-lg"
          >
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="month" className="text-lg">
            연월
          </label>
          <input
            id="month"
            type="month"
            name="month"
            defaultValue={month}
            className="h-14 rounded-lg border border-border px-4 text-lg"
          />
        </div>
        <Input id="q" name="q" label="품목명 검색" defaultValue={q} />
        <Button type="submit">조회</Button>
      </form>

      {clientsError && <p className="text-lg text-danger">원청 목록을 불러오지 못했습니다.</p>}
      {!clientsError && !clients?.length && (
        <p className="text-lg text-zinc-600">등록된 원청이 없습니다.</p>
      )}

      {clientId && loadError && (
        <p className="text-lg text-danger">단가 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>
      )}
      {clientId && !loadError && items.length === 0 && (
        <p className="text-lg text-zinc-600">등록된 품목이 없습니다.</p>
      )}

      {clientId && !loadError && items.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>품목명</Th>
              {sizes.map((s) => (
                <Th key={s.id}>{s.name}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.name}</Td>
                {sizes.map((size) => (
                  <Td key={size.id}>
                    <PriceCell
                      clientId={clientId}
                      itemId={item.id}
                      sizeId={size.id}
                      priceMonth={priceMonth}
                      initialValue={priceMap.get(`${item.id}-${size.id}`) ?? null}
                    />
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}
