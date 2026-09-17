"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

// 발송일은 최소 2일이어야 한다 — 검토일(최소 1일)이 발송일보다 앞서야
// 하는데, 발송일이 1일이면 그 조건을 만족하는 검토일이 존재하지 않는다.
function isValidSendDay(n: number) {
  return Number.isInteger(n) && n >= 2 && n <= 31;
}
function isValidReviewDay(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

/** 검증에 실패해도 방금 입력한 값을 잃지 않도록 쿼리에 함께 실어 돌려준다. */
function retryQuery(autoSendDay: number, ownerReviewDay: number, query: string): string {
  const params = new URLSearchParams(query);
  params.set("retry_auto_send_day", String(autoSendDay));
  params.set("retry_owner_review_day", String(ownerReviewDay));
  return params.toString();
}

export async function updateSchedule(formData: FormData) {
  await requireRole("owner");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/owner/clients");

  const autoSendDay = Number(formData.get("auto_send_day"));
  const ownerReviewDay = Number(formData.get("owner_review_day"));

  if (!isValidSendDay(autoSendDay) || !isValidReviewDay(ownerReviewDay)) {
    redirect(
      `/owner/clients/${id}/schedule?${retryQuery(autoSendDay, ownerReviewDay, "error=invalid_day")}`,
    );
  }
  if (ownerReviewDay >= autoSendDay) {
    redirect(
      `/owner/clients/${id}/schedule?${retryQuery(autoSendDay, ownerReviewDay, "error=review_after_send")}`,
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("clients")
    .update({ auto_send_day: autoSendDay, owner_review_day: ownerReviewDay })
    .eq("id", id);
  if (error) {
    redirect(
      `/owner/clients/${id}/schedule?${retryQuery(autoSendDay, ownerReviewDay, "error=save_failed")}`,
    );
  }

  revalidatePath("/owner/clients");
  revalidatePath(`/owner/clients/${id}/schedule`);
  redirect(`/owner/clients/${id}/schedule?saved=1`);
}
