import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "./session";
import { satisfiesRole } from "./authorize";
import { createServiceClient } from "@/lib/supabase/server";

export class ForbiddenError extends Error {}

/**
 * 서버 액션·라우트 핸들러 맨 앞에서 부른다. 권한이 없으면 던진다.
 *
 * 쿠키 디코드만으로는 부족하다 — docs/db-schema.md §0: "쿠키가 곧 세션이고,
 * 매 요청마다 staff_accounts.is_active만 재확인한다." 세션이 살아있는 최대
 * 12시간 동안 사장님이 그 직원을 사용 중지시켜도 쿠키만으로는 계속 통과하므로,
 * 직원 세션이면 매번 DB로 활성 여부를 다시 확인한다.
 */
export async function requireRole(role: "staff" | "owner") {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!satisfiesRole(session, role)) {
    throw new ForbiddenError(role === "owner" ? "사장님만 접근할 수 있습니다." : "로그인이 필요합니다.");
  }
  if (session!.role === "staff") {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("staff_accounts")
      .select("is_active")
      .eq("id", session!.staffId)
      .maybeSingle();
    if (!data?.is_active) {
      throw new ForbiddenError("이 계정은 더 이상 사용할 수 없습니다.");
    }
  }
  return session!;
}

/** 라우트 핸들러에서 requireRole이 던진 ForbiddenError를 403 응답으로 바꾼다. */
export function toForbiddenResponse(err: unknown) {
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  throw err;
}

/** 서버 컴포넌트 전용 — throw 대신 null을 돌려줘서 페이지가 리다이렉트하게 한다. */
export async function getSessionForRole(role: "staff" | "owner") {
  try {
    return await requireRole(role);
  } catch {
    return null;
  }
}
