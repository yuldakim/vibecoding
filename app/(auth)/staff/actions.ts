"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function selectStaffAccount(formData: FormData) {
  const staffId = Number(formData.get("staffId"));
  if (!Number.isInteger(staffId)) redirect("/staff");

  const supabase = createServiceClient();
  const { data: account } = await supabase
    .from("staff_accounts")
    .select("id")
    .eq("id", staffId)
    .eq("is_active", true)
    .maybeSingle();
  if (!account) redirect("/staff");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession({ role: "staff", staffId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/home");
}

export async function logoutStaff() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/staff");
}
