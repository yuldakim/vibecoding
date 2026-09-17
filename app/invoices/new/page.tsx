import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/db/like";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// 사용 중지된 원청이 새로 등록·복구된 것과 같은 요청 안에서 바로 반영돼야
// 한다 — 정적 프리렌더되면 배포 시점 목록이 굳는다(다른 화면들과 같은 이유).
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; clientId?: string };

function pickerHref(id: number, q: string | undefined) {
  const params = new URLSearchParams({ clientId: String(id) });
  if (q) params.set("q", q);
  return `/invoices/new?${params.toString()}`;
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionForRole("staff");
  if (!session) redirect("/select");

  const { q, clientId } = await searchParams;
  const supabase = createServiceClient();
  let query = supabase.from("clients").select("id, name").eq("is_active", true).order("name");
  if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
  const { data: clients, error } = await query;

  const selectedId = clientId ? Number(clientId) : NaN;
  const selected = clients?.find((c) => c.id === selectedId);

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">새 송장 만들기</h1>
      <p className="text-lg text-zinc-600">원청을 먼저 고르세요.</p>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <Input id="q" name="q" label="업체명 검색" defaultValue={q ?? ""} placeholder="예: 이불나라" />
        <Button type="submit">검색</Button>
      </form>

      {error && (
        <p className="text-lg text-danger">원청 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>
      )}
      {!error && !clients?.length && (
        <p className="text-lg text-zinc-600">
          {q ? "검색 결과가 없습니다." : "사용 중인 원청이 없습니다."}
        </p>
      )}

      {!error && clients && clients.length > 0 && (
        <div className="flex flex-col gap-3">
          {clients.map((c) => (
            <a
              key={c.id}
              href={pickerHref(c.id, q)}
              className={`flex min-h-14 items-center rounded-lg border px-6 py-2 text-lg font-semibold ${
                c.id === selectedId ? "border-primary bg-primary/10" : "border-border hover:bg-black/5"
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      )}

      {selected && (
        <p className="rounded-lg border border-border p-4 text-lg">
          <strong>{selected.name}</strong>을(를) 선택했습니다. 다음 단계(품목 입력)는 곧 만들어집니다.
        </p>
      )}
    </main>
  );
}
