"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { MAX_LINES, MAX_QUANTITY } from "./constants";

/**
 * 품목을 임시 송장에 줄로 추가한다. 기본 사이즈(정렬 1순위)·수량 1로 넣고,
 * 사이즈·수량은 바로 이어서 LineRow에서 조정한다. item_name_snapshot은
 * 지금 이 순간의 품목명을 그대로 굳힌다 — 나중에 품목명이 바뀌거나
 * 합쳐져도 이 줄의 표시는 안 바뀐다(§4).
 */
export async function addLine(invoiceId: number, itemId: number) {
  await requireRole("staff");
  const supabase = createServiceClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, client_id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice || invoice.status !== "draft") redirect(`/invoices/new/${invoiceId}?error=not_draft`);

  const { data: item } = await supabase
    .from("items")
    .select("id, name")
    .eq("id", itemId)
    .eq("client_id", invoice.client_id)
    .is("merged_into_item_id", null)
    .eq("is_hidden", false)
    .maybeSingle();
  if (!item) redirect(`/invoices/new/${invoiceId}?error=item_unavailable`);

  const { count } = await supabase
    .from("invoice_lines")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);
  if ((count ?? 0) >= MAX_LINES) redirect(`/invoices/new/${invoiceId}?error=max_lines`);

  const { data: firstSize } = await supabase.from("sizes").select("id").order("sort_order").limit(1).maybeSingle();
  if (!firstSize) redirect(`/invoices/new/${invoiceId}?error=no_sizes`);

  const { data: lastLine } = await supabase
    .from("invoice_lines")
    .select("line_order")
    .eq("invoice_id", invoiceId)
    .order("line_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (lastLine?.line_order ?? 0) + 1;

  const { error } = await supabase.from("invoice_lines").insert({
    invoice_id: invoiceId,
    item_id: item.id,
    item_name_snapshot: item.name,
    size_id: firstSize.id,
    quantity: 1,
    line_order: nextOrder,
  });
  if (error) redirect(`/invoices/new/${invoiceId}?error=save_failed`);

  revalidatePath(`/invoices/new/${invoiceId}`);
  redirect(`/invoices/new/${invoiceId}`);
}

export type UpdateLineResult = { ok: true } | { ok: false; error: string };

/** 사이즈·수량 저장 — 동시 편집 시 마지막 저장이 그대로 반영된다(§7 "마지막 저장 우선"). */
export async function updateLine(lineId: number, sizeId: number, quantity: number): Promise<UpdateLineResult> {
  await requireRole("staff");
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    return { ok: false, error: `수량은 1~${MAX_QUANTITY}장 사이의 정수여야 합니다.` };
  }

  const supabase = createServiceClient();
  const { data: line } = await supabase
    .from("invoice_lines")
    .select("id, invoice_id, invoices(status)")
    .eq("id", lineId)
    .maybeSingle();
  const status = (line?.invoices as { status?: string } | null)?.status;
  if (!line || status !== "draft") return { ok: false, error: "이미 확정되었거나 존재하지 않는 송장입니다." };

  const { data: size } = await supabase.from("sizes").select("id").eq("id", sizeId).maybeSingle();
  if (!size) return { ok: false, error: "존재하지 않는 사이즈입니다." };

  const { error } = await supabase.from("invoice_lines").update({ size_id: sizeId, quantity }).eq("id", lineId);
  if (error) return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };

  revalidatePath(`/invoices/new/${line.invoice_id}`);
  return { ok: true };
}

export type DeleteLineResult = { ok: true } | { ok: false; error: string };

/** 줄 삭제 — 임시 송장 자체가 아니라 그 안의 한 줄만 지운다(자유롭게 고칠 수 있는 임시 상태, §7). */
export async function deleteLine(lineId: number): Promise<DeleteLineResult> {
  await requireRole("staff");
  const supabase = createServiceClient();
  const { data: line } = await supabase
    .from("invoice_lines")
    .select("id, invoice_id, invoices(status)")
    .eq("id", lineId)
    .maybeSingle();
  const status = (line?.invoices as { status?: string } | null)?.status;
  if (!line || status !== "draft") {
    return { ok: false, error: "이미 지워졌거나 확정된 줄입니다. 새로고침 후 확인하세요." };
  }

  const { error } = await supabase.from("invoice_lines").delete().eq("id", lineId);
  if (error) return { ok: false, error: "삭제하지 못했습니다. 잠시 후 다시 시도하세요." };

  revalidatePath(`/invoices/new/${line.invoice_id}`);
  return { ok: true };
}
