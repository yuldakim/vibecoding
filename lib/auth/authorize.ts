import type { decodeSession } from "./session";

type Session = NonNullable<ReturnType<typeof decodeSession>>;

/**
 * 세션이 role을 만족하는지 순수하게 판정한다. Next.js 런타임 의존성이 없어
 * 독립적으로 테스트할 수 있다. 사장님은 직원 권한도 포함하므로 role:'staff'
 * 요구는 staff·owner 세션 둘 다 통과시키고, role:'owner' 요구는 owner
 * 세션만 통과한다.
 */
export function satisfiesRole(session: Session | null, role: "staff" | "owner"): boolean {
  if (!session) return false;
  if (role === "owner") return session.role === "owner";
  return true;
}
