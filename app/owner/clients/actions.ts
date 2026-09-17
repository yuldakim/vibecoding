"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

/** 절대 delete하지 않는다 — is_active만 바꾼다(§24 삭제 금지). */
export async function toggleClientActive(id: number, nextActive: boolean) {
  await requireRole("owner");
  const supabase = createServiceClient();
  await supabase.from("clients").update({ is_active: nextActive }).eq("id", id);
  revalidatePath("/owner/clients");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_FIELDS = ["name", "contact_name", "contact_email", "phone", "address"] as const;

// 발송일은 최소 2일이어야 한다 — 검토일은 발송일보다 앞서야 하는데(T-023),
// 발송일이 1일이면 그 조건을 만족하는 검토일이 존재하지 않는다.
function isValidSendDay(n: number) {
  return Number.isInteger(n) && n >= 2 && n <= 31;
}
function isValidReviewDay(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

export async function createClient(formData: FormData) {
  await requireRole("owner");

  const values: Record<string, string> = {};
  for (const field of REQUIRED_FIELDS) values[field] = String(formData.get(field) ?? "").trim();
  const autoSendDay = Number(formData.get("auto_send_day"));
  const ownerReviewDay = Number(formData.get("owner_review_day"));

  const missing = REQUIRED_FIELDS.filter((f) => !values[f]);
  if (missing.length > 0) redirect(`/owner/clients?error=missing&fields=${missing.join(",")}`);
  if (!EMAIL_RE.test(values.contact_email)) redirect("/owner/clients?error=invalid_email");
  if (!isValidSendDay(autoSendDay) || !isValidReviewDay(ownerReviewDay)) {
    redirect("/owner/clients?error=invalid_day");
  }
  if (ownerReviewDay >= autoSendDay) redirect("/owner/clients?error=review_after_send");

  const supabase = createServiceClient();
  const { error } = await supabase.from("clients").insert({
    ...values,
    auto_send_day: autoSendDay,
    owner_review_day: ownerReviewDay,
  });
  if (error) redirect("/owner/clients?error=save_failed");

  revalidatePath("/owner/clients");
  redirect("/owner/clients?created=1");
}
