import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/db/like";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Th, Td } from "@/components/ui/table";

// 목록은 요청마다 새로 조회해야 한다 — 정적 프리렌더되면 새로 등록·중지한
// 원청이 배포 전까지 안 보인다(과거 /staff 리뷰에서 지적된 패턴).
export const dynamic = "force-dynamic";

type Client = {
  id: number;
  name: string;
  contact_name: string;
  auto_send_day: number;
  is_active: boolean;
};

export default async function OwnerClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; showInactive?: string }>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const { q, showInactive } = await searchParams;
  const includeInactive = showInactive === "1";

  const supabase = createServiceClient();
  let query = supabase
    .from("clients")
    .select("id, name, contact_name, auto_send_day, is_active")
    .order("name");
  if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  const clients = (data ?? []) as Client[];

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">원청 관리</h1>

      <form method="get" className="flex flex-wrap items-end gap-4">
        <Input id="q" name="q" label="업체명 검색" defaultValue={q ?? ""} placeholder="예: 이불나라" />
        <label className="flex h-14 items-center gap-2 text-lg">
          <input type="checkbox" name="showInactive" value="1" defaultChecked={includeInactive} className="h-5 w-5" />
          사용 중지 포함
        </label>
        <Button type="submit">검색</Button>
      </form>

      {error ? (
        <p className="text-lg text-danger">목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>
      ) : clients.length === 0 ? (
        <p className="text-lg text-zinc-600">등록된 원청이 없습니다.</p>
      ) : (
        <>
          {/* 태블릿 이상: 표. 휴대폰 폭: 카드 목록(같은 데이터, 다른 레이아웃) */}
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>업체명</Th>
                  <Th>담당자</Th>
                  <Th>발송일</Th>
                  <Th>상태</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <a href={`/owner/clients/${c.id}`} className="underline">
                        {c.name}
                      </a>
                    </Td>
                    <Td>{c.contact_name}</Td>
                    <Td>매월 {c.auto_send_day}일</Td>
                    <Td>{c.is_active ? "사용 중" : <span className="text-zinc-600">사용 중지</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {clients.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-4">
                <a href={`/owner/clients/${c.id}`} className="text-lg font-semibold underline">
                  {c.name}
                </a>
                <p className="text-lg">담당자: {c.contact_name}</p>
                <p className="text-lg">발송일: 매월 {c.auto_send_day}일</p>
                <p className={`text-lg ${c.is_active ? "" : "text-zinc-600"}`}>
                  {c.is_active ? "사용 중" : "사용 중지"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
