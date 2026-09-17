import { notFound, redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/db/like";
import { sortByFavoriteThenRecency } from "@/lib/items/recency";
import { getSizes, type Size } from "@/lib/sizes/queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addLine } from "./actions";
import { MAX_LINES } from "./constants";
import { LineRow } from "./line-row";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  not_draft: "이미 확정되었거나 존재하지 않는 송장입니다.",
  item_unavailable: "이 원청에 없는 품목입니다.",
  max_lines: `한 송장에는 최대 ${MAX_LINES}줄까지 담을 수 있습니다. 줄을 지운 뒤 추가하세요.`,
  no_sizes: "등록된 사이즈가 없습니다. 사이즈를 먼저 만드세요.",
  save_failed: "저장하지 못했습니다. 잠시 후 다시 시도하세요.",
};

type SearchParams = { itemQ?: string; error?: string };

export default async function InvoiceDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionForRole("staff");
  if (!session) redirect("/select");

  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId)) notFound();

  const supabase = createServiceClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, client_id, status, clients(name)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice || invoice.status !== "draft") notFound();
  const clientName = (invoice.clients as unknown as { name: string } | null)?.name ?? "";

  let sizes: Size[] = [];
  let sizesError = false;
  try {
    sizes = await getSizes();
  } catch {
    sizesError = true;
  }

  const { itemQ, error } = await searchParams;

  const { data: lineRows, error: linesError } = await supabase
    .from("invoice_lines")
    .select("id, item_name_snapshot, size_id, quantity")
    .eq("invoice_id", invoiceId)
    .order("line_order")
    .order("id");
  const lines = lineRows ?? [];
  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  const atMax = lines.length >= MAX_LINES;

  let items: { id: number; name: string; is_favorite: boolean }[] = [];
  let itemsError = false;
  if (!sizesError) {
    let itemsQuery = supabase
      .from("items")
      .select("id, name, is_favorite, is_hidden, last_used_at")
      .eq("client_id", invoice.client_id)
      .is("merged_into_item_id", null)
      .eq("is_hidden", false);
    if (itemQ) itemsQuery = itemsQuery.ilike("name", `%${escapeLike(itemQ)}%`);
    const { data: itemRows, error: itemsErr } = await itemsQuery;
    items = itemRows ? sortByFavoriteThenRecency(itemRows) : [];
    itemsError = !!itemsErr;
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">새 송장 만들기</h1>
      <p className="text-lg">
        <strong>{clientName}</strong> · 임시 저장됨(번호 없음)
      </p>

      {sizesError && (
        <p className="text-lg text-danger">사이즈 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>
      )}
      {error && <p className="text-lg text-danger">{ERROR_MESSAGES[error] ?? "처리하지 못했습니다."}</p>}
      {linesError && (
        <p className="text-lg text-danger">추가된 품목을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.</p>
      )}

      {!sizesError && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">품목 추가</h2>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Input id="itemQ" name="itemQ" label="품목명 검색" defaultValue={itemQ ?? ""} placeholder="예: 차렵이불" />
            <Button type="submit">검색</Button>
          </form>

          {itemsError && (
            <p className="text-lg text-danger">품목 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>
          )}
          {atMax && (
            <p className="text-lg text-danger">
              한 송장에는 최대 {MAX_LINES}줄까지 담을 수 있습니다. 줄을 지운 뒤 추가하세요.
            </p>
          )}
          {!itemsError && items.length === 0 && <p className="text-lg text-zinc-600">품목이 없습니다.</p>}
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <form key={item.id} action={addLine.bind(null, invoiceId, item.id)}>
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
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">
          추가된 품목 ({lines.length}줄 · 전체 {totalQuantity}장)
        </h2>
        {lines.length === 0 && <p className="text-lg text-zinc-600">아직 추가된 품목이 없습니다.</p>}
        <div className="flex flex-col gap-3">
          {lines.map((line) => (
            <LineRow
              // lineId만으로 key를 잡으면 "이 줄 자신의" 사이즈·수량이 다른
              // 기기/탭에서 바뀌어도(revalidatePath는 리렌더만 시키지
              // 리마운트는 안 시킴) 화면이 옛 값을 계속 보여준다 — T-037에서
              // 겪은 것과 같은 문제다. size_id·quantity를 key에 포함시켜
              // 서버 값이 실제로 바뀌면 항상 리마운트되게 한다.
              key={`${line.id}:${line.size_id}:${line.quantity}`}
              lineId={line.id}
              itemName={line.item_name_snapshot}
              sizeId={line.size_id}
              quantity={line.quantity}
              sizes={sizes}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
