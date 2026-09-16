import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { toKstYearMonth } from "@/lib/date/kst";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { copyMonthlyPrices } from "./actions";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-\d{2}$/;

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m은 1~12, Date는 0~11이라 -2
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type SearchParams = {
  clientId?: string;
  fromMonth?: string;
  toMonth?: string;
  error?: string;
  created?: string;
  skipped?: string;
  overwritten?: string;
  failed?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  same_month: "복사 원본과 대상이 같은 달일 수 없습니다.",
  no_source: "복사할 단가가 없습니다.",
};

export default async function CopyPricesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const sp = await searchParams;
  const thisMonth = toKstYearMonth(new Date());
  const toMonth = sp.toMonth && MONTH_RE.test(sp.toMonth) ? sp.toMonth : thisMonth;
  const fromMonth =
    sp.fromMonth && MONTH_RE.test(sp.fromMonth) ? sp.fromMonth : previousMonth(toMonth);

  const supabase = createServiceClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const parsedClientId = sp.clientId ? Number(sp.clientId) : NaN;
  const clientId = Number.isInteger(parsedClientId) ? parsedClientId : clients?.[0]?.id;

  let sourceCount = 0;
  let overlapCount = 0;
  if (clientId) {
    const [{ data: sourceRows }, { data: targetRows }] = await Promise.all([
      supabase
        .from("monthly_prices")
        .select("item_id, size_id")
        .eq("client_id", clientId)
        .eq("price_month", `${fromMonth}-01`),
      supabase
        .from("monthly_prices")
        .select("item_id, size_id")
        .eq("client_id", clientId)
        .eq("price_month", `${toMonth}-01`),
    ]);
    sourceCount = sourceRows?.length ?? 0;
    const targetKeys = new Set((targetRows ?? []).map((r) => `${r.item_id}-${r.size_id}`));
    overlapCount = (sourceRows ?? []).filter((r) => targetKeys.has(`${r.item_id}-${r.size_id}`)).length;
  }

  const resultShown = sp.created !== undefined;

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">지난달 단가표 복사</h1>

      {sp.error && <p className="text-lg text-danger">{ERROR_MESSAGES[sp.error] ?? sp.error}</p>}
      {resultShown && (
        <p className="text-lg text-primary">
          새로 채움 {sp.created}건 · 이미 있어서 건너뜀 {sp.skipped}건
          {Number(sp.overwritten) > 0 && ` · 덮어씀 ${sp.overwritten}건`}
        </p>
      )}
      {resultShown && Number(sp.failed) > 0 && (
        <p className="text-lg text-danger">저장 실패 {sp.failed}건 — 잠시 후 다시 시도하세요.</p>
      )}

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
        <Input id="fromMonth" name="fromMonth" type="month" label="복사할 원본 월" defaultValue={fromMonth} />
        <Input id="toMonth" name="toMonth" type="month" label="복사될 대상 월" defaultValue={toMonth} />
        <Button type="submit">미리보기</Button>
      </form>

      {clientId && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="text-lg">
            {fromMonth} 단가 {sourceCount}건 중 {toMonth}에 이미 값이 있는 조합{" "}
            <strong>{overlapCount}건</strong>
          </p>
          <form action={copyMonthlyPrices} className="flex flex-wrap items-center gap-4">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="fromMonth" value={fromMonth} />
            <input type="hidden" name="toMonth" value={toMonth} />
            <label className="flex h-14 items-center gap-2 text-lg">
              <input type="checkbox" name="overwriteExisting" value="1" className="h-5 w-5" />
              이미 있는 값도 덮어쓰기
            </label>
            <Button type="submit" disabled={sourceCount === 0}>
              지금 복사하기
            </Button>
          </form>
        </div>
      )}
    </main>
  );
}
