import { notFound, redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSchedule } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_day: "발송일은 2~31, 검토 기준일은 1~31 사이 숫자로 입력하세요.",
  review_after_send: "검토 기준일은 발송일보다 앞선 날짜여야 합니다.",
  save_failed: "저장에 실패했습니다. 잠시 후 다시 시도하세요.",
};

export default async function ClientSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();

  const supabase = createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, auto_send_day, owner_review_day")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const sp = await searchParams;

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">{client.name} · 정산 일정 설정</h1>

      {sp.error && <p className="text-lg text-danger">{ERROR_MESSAGES[sp.error] ?? "저장하지 못했습니다."}</p>}
      {sp.saved === "1" && <p className="text-lg text-primary">저장했습니다.</p>}

      <p className="text-lg text-zinc-600">
        매월 {client.auto_send_day}일에 자동 발송, {client.owner_review_day}일부터 확인 요청
      </p>
      <p className="text-lg text-zinc-600">
        월에 따라 그 날짜가 없으면(29~31일) 말일로 처리됩니다.
      </p>

      <form action={updateSchedule} className="flex max-w-sm flex-col gap-4">
        <input type="hidden" name="id" value={client.id} />
        <Input
          id="auto_send_day"
          name="auto_send_day"
          type="number"
          min={2}
          max={31}
          label="정산서 발송일"
          defaultValue={sp.error ? sp.retry_auto_send_day ?? client.auto_send_day : client.auto_send_day}
        />
        <Input
          id="owner_review_day"
          name="owner_review_day"
          type="number"
          min={1}
          max={31}
          label="사장님 검토 기준일"
          defaultValue={
            sp.error ? sp.retry_owner_review_day ?? client.owner_review_day : client.owner_review_day
          }
        />
        <Button type="submit">저장</Button>
      </form>
    </main>
  );
}
