import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { satisfiesRole } from "@/lib/auth/authorize";

// /owner-home 이하 전부를 1차 방어선으로 막는다(쿠키만 검사 — DB의
// is_active 재확인 같은 정밀 검사는 각 페이지의 requireRole이 이미 한다).
// /owner(비밀번호 입력 화면) 자체는 막지 않는다 — 막으면 로그인을 못 한다.
export function proxy(request: NextRequest) {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!satisfiesRole(session, "owner")) {
    return NextResponse.redirect(new URL("/owner", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // 지금 있는 사장님 화면은 /owner-home 아래고, 앞으로 만들 화면들
  // (T-020/T-021/T-026/T-051/T-061 등)은 백로그 문서에 /owner/... 로
  // 적혀 있다 — 둘 다 잡는다. `:path+`(1개 이상)를 써서 로그인 화면인
  // /owner 자체는 매칭에서 빠지게 한다(무한 리다이렉트 방지).
  matcher: ["/owner-home/:path*", "/owner/:path+"],
};
