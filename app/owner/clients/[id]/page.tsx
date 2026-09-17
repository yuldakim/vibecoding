import { notFound, redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateClient } from "./actions";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  name: "업체명",
  contact_name: "담당자명",
  contact_email: "담당자 이메일",
  phone: "전화번호",
  address: "주소",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "담당자 이메일 형식이 올바르지 않습니다.",
  save_failed: "저장에 실패했습니다. 잠시 후 다시 시도하세요.",
};

export default async function ClientDetailPage({
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
    .select("id, name, contact_name, contact_email, phone, address")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const sp = await searchParams;
  const missingFields = (sp.fields ?? "")
    .split(",")
    .filter((f) => f in FIELD_LABELS)
    .map((f) => FIELD_LABELS[f]);
  // 검증에 실패해 돌아온 경우, 방금 입력한 값(retry_*)을 DB 값 대신 보여준다.
  const fieldValue = (field: keyof typeof FIELD_LABELS, dbValue: string) =>
    sp.error ? sp[`retry_${field}`] ?? dbValue : dbValue;

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">원청 정보 수정</h1>

      {sp.error === "missing" && missingFields.length > 0 && (
        <p className="text-lg text-danger">다음 항목을 입력하세요: {missingFields.join(", ")}</p>
      )}
      {sp.error && sp.error !== "missing" && (
        <p className="text-lg text-danger">{ERROR_MESSAGES[sp.error] ?? "저장하지 못했습니다."}</p>
      )}
      {sp.saved === "1" && <p className="text-lg text-primary">저장했습니다.</p>}

      <div className="flex gap-4">
        <a href={`/owner/clients/${client.id}/schedule`} className="text-lg text-primary underline">
          정산 일정 설정
        </a>
        <a href={`/owner/clients/${client.id}/email-template`} className="text-lg text-primary underline">
          이메일 문구 설정
        </a>
      </div>

      <form action={updateClient} className="flex max-w-sm flex-col gap-4">
        <input type="hidden" name="id" value={client.id} />
        <Input id="name" name="name" label="업체명" defaultValue={fieldValue("name", client.name)} />
        <Input
          id="contact_name"
          name="contact_name"
          label="담당자명"
          defaultValue={fieldValue("contact_name", client.contact_name)}
        />
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          label="담당자 이메일"
          defaultValue={fieldValue("contact_email", client.contact_email)}
        />
        <Input id="phone" name="phone" label="전화번호" defaultValue={fieldValue("phone", client.phone)} />
        <Input id="address" name="address" label="주소" defaultValue={fieldValue("address", client.address)} />
        <Button type="submit">저장</Button>
      </form>
    </main>
  );
}
