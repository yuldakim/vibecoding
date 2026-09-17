"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { toKstDateString } from "@/lib/date/kst";

/**
 * 원청을 고르는 순간 임시 송장(draft) 한 개를 새로 만든다(§7). 송장번호는
 * 부여하지 않는다(invoice_no는 NULL로 남고, DB 체크 제약이 status='draft'와
 * invoice_no IS NULL을 서로 강제한다). 납품 날짜는 오늘(KST)을 기본값으로
 * 두고, 실제 날짜 변경 UI는 T-040이 만든다.
 */
export async function startDraftInvoice(formData: FormData) {
  await requireRole("staff");

  const clientId = Number(formData.get("clientId"));
  if (!Number.isInteger(clientId)) redirect("/invoices/new");

  const supabase = createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("is_active", true)
    .maybeSingle();
  if (!client) redirect("/invoices/new?error=save_failed");

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({ client_id: clientId, delivery_date: toKstDateString(new Date()), status: "draft" })
    .select("id")
    .single();
  if (error || !invoice) redirect("/invoices/new?error=save_failed");

  redirect(`/invoices/new/${invoice.id}`);
}
