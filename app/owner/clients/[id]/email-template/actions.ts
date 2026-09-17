"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

export async function updateEmailTemplate(formData: FormData) {
  await requireRole("owner");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/owner/clients");

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("clients")
    .update({ email_subject_template: subject, email_body_template: body })
    .eq("id", id);
  if (error) {
    // 저장 실패로 돌아가도 방금 쓴 문구를 잃지 않게 돌려준다.
    const params = new URLSearchParams({ error: "save_failed", retry_subject: subject, retry_body: body });
    redirect(`/owner/clients/${id}/email-template?${params.toString()}`);
  }

  revalidatePath(`/owner/clients/${id}/email-template`);
  redirect(`/owner/clients/${id}/email-template?saved=1`);
}
