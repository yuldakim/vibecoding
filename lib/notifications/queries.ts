import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session-guard";

const COLS = "id, kind, target_role, ref_type, ref_id, created_at, resolved_at";

/**
 * notifications 테이블엔 금액 컬럼이 없지만, select를 명시해 나중에 컬럼이
 * 늘어도 안전하게 한다. `role`을 인자로만 받으면 호출자가 실제 세션과
 * 다른 role을 넘겨 다른 역할의 알림을 볼 수 있으므로, 넘어온 role이 실제
 * 세션과 맞는지 `requireRole`로 다시 확인한다.
 */
export async function getNotificationsForRole(role: "staff" | "owner") {
  await requireRole(role);
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(COLS)
    .in("target_role", [role, "both"])
    .eq("is_resolved", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
