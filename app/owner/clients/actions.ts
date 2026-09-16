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

function isValidDay(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 28;
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
  if (!isValidDay(autoSendDay) || !isValidDay(ownerReviewDay)) {
    redirect("/owner/clients?error=invalid_day");
  }

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
