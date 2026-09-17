import { notFound, redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveSubjectTemplate, resolveBodyTemplate } from "@/lib/email/template";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

export default async function ClientEmailTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; retry_subject?: string; retry_body?: string }>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();

  const supabase = createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email_subject_template, email_body_template")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const sp = await searchParams;

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">{client.name} · 이메일 문구 설정</h1>

      {sp.error && <p className="text-lg text-danger">저장하지 못했습니다. 잠시 후 다시 시도하세요.</p>}
      {sp.saved === "1" && <p className="text-lg text-primary">저장했습니다.</p>}

      <TemplateEditor
        clientId={client.id}
        initialSubject={sp.error ? sp.retry_subject ?? "" : resolveSubjectTemplate(client.email_subject_template)}
        initialBody={sp.error ? sp.retry_body ?? "" : resolveBodyTemplate(client.email_body_template)}
      />
    </main>
  );
}
