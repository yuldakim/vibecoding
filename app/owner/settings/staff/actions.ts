"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

function revalidateStaffPaths() {
  revalidatePath("/owner/settings/staff");
  revalidatePath("/select");
  revalidatePath("/staff");
}

export async function addStaffAccount(formData: FormData) {
  await requireRole("owner");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = createServiceClient();
  // 같은 이름이 이미 있으면(중지된 옛 계정 포함) 새로 만들지 않고 그 행을
  // 재사용한다 — 동명이인처럼 보이는 중복 행이 생기면 §24(삭제 금지)상
  // 되돌릴 방법이 없고, /select에서 구분 안 되는 버튼이 두 개가 된다.
  const { data: existing } = await supabase
    .from("staff_accounts")
    .select("id, is_active")
    .eq("name", name)
    .maybeSingle();
  if (existing) {
    if (!existing.is_active) {
      await supabase.from("staff_accounts").update({ is_active: true }).eq("id", existing.id);
    }
    revalidateStaffPaths();
    return;
  }

  await supabase.from("staff_accounts").insert({ name, is_active: true });
  revalidateStaffPaths();
}

/** 절대 delete하지 않는다 — is_active만 바꾼다(§24 삭제 금지). */
export async function toggleStaffAccountActive(id: number, nextActive: boolean) {
  await requireRole("owner");
  const supabase = createServiceClient();
  await supabase.from("staff_accounts").update({ is_active: nextActive }).eq("id", id);
  revalidateStaffPaths();
}
