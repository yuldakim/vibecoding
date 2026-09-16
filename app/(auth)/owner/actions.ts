"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyOwnerPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const supabase = createServiceClient();

  const { data: settings } = await supabase
    .from("factory_settings")
    .select("owner_password_hash, owner_login_fail_count, owner_locked_until")
    .eq("id", 1)
    .single();
  if (!settings) redirect("/owner?error=no_settings");

  if (settings.owner_locked_until && new Date(settings.owner_locked_until) > new Date()) {
    redirect("/owner?error=locked");
  }

  const ok = verifyPassword(password, settings.owner_password_hash);

  if (!ok) {
    // 실패 카운트는 읽고-고치고-쓰는 방식이 아니라 DB에서 원자적으로
    // 증가시킨다 — 동시 요청 여러 개가 각자 "0+1"을 계산해서 쓰면
    // 카운트가 안 쌓여 5회 잠금이 무력화된다.
    const { data: updated } = await supabase.rpc("record_owner_login_failure", {
      p_lock_ms: LOCK_MS,
      p_max_fails: MAX_FAILS,
    });
    const fails = updated?.[0]?.owner_login_fail_count ?? 1;
    // ponytail: 실패 횟수에 비례한 고정 지연으로 무차별 대입을 늦춘다. 분산 락/레이트리미터 없음 — 단일 인스턴스 내부용 사이트라 충분.
    await sleep(Math.min(fails * 500, 4000));
    redirect("/owner?error=wrong");
  }

  await supabase
    .from("factory_settings")
    .update({ owner_login_fail_count: 0, owner_locked_until: null })
    .eq("id", 1);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession({ role: "owner" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/owner-home");
}

export async function logoutOwner() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/owner");
}
