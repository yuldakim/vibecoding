"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session-guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createServiceClient } from "@/lib/supabase/server";

export async function changeOwnerPassword(formData: FormData) {
  await requireRole("owner");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("factory_settings")
    .select("owner_password_hash")
    .eq("id", 1)
    .single();

  if (!settings || !verifyPassword(current, settings.owner_password_hash)) {
    redirect("/owner-home/password?error=current_wrong");
  }
  if (next.length < 4 || next !== confirm) {
    redirect("/owner-home/password?error=next_invalid");
  }

  const { error: updateError } = await supabase
    .from("factory_settings")
    .update({ owner_password_hash: hashPassword(next), updated_at: new Date().toISOString() })
    .eq("id", 1);
  // DB 쓰기가 실패했는데 "바뀌었다"고 기록하거나 성공 화면으로 보내면 안 된다 —
  // 사장님이 안 바뀐 새 비밀번호로 로그인을 반복하다 계정이 잠긴다.
  if (updateError) redirect("/owner-home/password?error=save_failed");

  // before/after에 비밀번호 원문·해시를 넣지 않는다 — 바뀌었다는 사실만 남긴다.
  await supabase.from("audit_logs").insert({
    target_type: "factory_settings",
    target_id: 1,
    action: "owner_password_changed",
    before: { changed: false },
    after: { changed: true },
    actor_role: "owner",
  });

  redirect("/owner-home?passwordChanged=1");
}
