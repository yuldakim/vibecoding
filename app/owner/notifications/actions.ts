"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

export async function resolveNotification(formData: FormData) {
  await requireRole("owner");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const supabase = createServiceClient();
  // target_role도 함께 걸어서, 사장님 화면에서 임의 id를 보내 직원 전용
  // 알림까지 해제해버리는 걸 막는다(이 화면은 owner/both 대상만 다룬다).
  await supabase
    .from("notifications")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .in("target_role", ["owner", "both"]);

  revalidatePath("/owner/notifications");
}
