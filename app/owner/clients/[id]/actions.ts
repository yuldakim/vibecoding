"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

const REQUIRED_FIELDS = ["name", "contact_name", "contact_email", "phone", "address"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 검증에 실패해도 방금 입력한 값을 잃지 않도록 쿼리에 함께 실어 돌려준다. */
function retryQuery(values: Record<string, string>, query: string): string {
  const params = new URLSearchParams(query);
  for (const [k, v] of Object.entries(values)) params.set(`retry_${k}`, v);
  return params.toString();
}

export async function updateClient(formData: FormData) {
  await requireRole("owner");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/owner/clients");

  const values: Record<string, string> = {};
  for (const field of REQUIRED_FIELDS) values[field] = String(formData.get(field) ?? "").trim();

  const supabase = createServiceClient();
  const { data: before } = await supabase
    .from("clients")
    .select("name, contact_name, contact_email, phone, address")
    .eq("id", id)
    .maybeSingle();
  if (!before) redirect("/owner/clients");

  const missing = REQUIRED_FIELDS.filter((f) => !values[f]);
  if (missing.length > 0) {
    redirect(`/owner/clients/${id}?${retryQuery(values, `error=missing&fields=${missing.join(",")}`)}`);
  }
  if (!EMAIL_RE.test(values.contact_email)) {
    redirect(`/owner/clients/${id}?${retryQuery(values, "error=invalid_email")}`);
  }

  const { error } = await supabase.from("clients").update(values).eq("id", id);
  if (error) redirect(`/owner/clients/${id}?${retryQuery(values, "error=save_failed")}`);

  await supabase.from("audit_logs").insert({
    target_type: "clients",
    target_id: id,
    action: "client_updated",
    before,
    after: values,
    actor_role: "owner",
  });

  revalidatePath("/owner/clients");
  revalidatePath(`/owner/clients/${id}`);
  redirect(`/owner/clients/${id}?saved=1`);
}
