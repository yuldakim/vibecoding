"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";

function itemsPath(clientId: number) {
  return `/owner/items?clientId=${clientId}`;
}

/**
 * 신규 등록 + 이름 그대로의 단순 오타 수정까지만 다룬다. 이력을 남기는
 * 진짜 "이름 변경"(합치기 포함)은 T-032 몫이다 — 여기서는 만들지 않는다.
 */
export async function addItem(formData: FormData) {
  await requireRole("owner");
  const clientId = Number(formData.get("clientId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!Number.isInteger(clientId) || !name) return;

  const supabase = createServiceClient();
  // 합쳐져서 더는 "현재 이름"이 아닌 품목은 중복 검사에서 뺀다
  // (docs/db-schema.md의 items 부분 유니크 제약과 같은 기준).
  const { data: existing } = await supabase
    .from("items")
    .select("id, name, is_hidden")
    .eq("client_id", clientId)
    .is("merged_into_item_id", null)
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    // 이미 있는 품목이 숨김 상태면 기본 목록에는 안 보인다 — 안 그러면
    // 사장님이 "이미 있습니다"만 보고 그 품목을 영원히 못 찾는다.
    redirect(`${itemsPath(clientId)}&error=${existing.is_hidden ? "duplicate_hidden" : "duplicate"}`);
  }

  const { error } = await supabase.from("items").insert({ client_id: clientId, name });
  if (error) redirect(`${itemsPath(clientId)}&error=save_failed`);
  revalidatePath(itemsPath(clientId));
  redirect(itemsPath(clientId));
}

export async function toggleItemFavorite(id: number, clientId: number, next: boolean) {
  await requireRole("owner");
  const supabase = createServiceClient();
  await supabase.from("items").update({ is_favorite: next }).eq("id", id);
  revalidatePath(itemsPath(clientId));
}

/** 절대 delete하지 않는다 — is_hidden만 바꾼다(§24 삭제 금지). */
export async function toggleItemHidden(id: number, clientId: number, next: boolean) {
  await requireRole("owner");
  const supabase = createServiceClient();
  await supabase.from("items").update({ is_hidden: next }).eq("id", id);
  revalidatePath(itemsPath(clientId));
}
