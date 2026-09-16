import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { logoutStaff } from "@/app/(auth)/staff/actions";
import { Nav } from "@/components/nav/nav";

export default async function StaffHomePage() {
  // "staff" 요구는 staff·owner 세션 둘 다 통과한다(사장님=직원 권한 포함, §2).
  const session = await getSessionForRole("staff");
  if (!session) redirect("/select");

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">직원 홈 — 준비 중</h1>
      <Nav role="staff" />
      <div className="flex gap-3">
        <Link href="/owner" className="flex h-14 items-center rounded-lg border border-zinc-300 px-6 text-lg font-semibold">
          사장님 모드로
        </Link>
        <form action={logoutStaff}>
          <button
            type="submit"
            className="h-14 rounded-lg border border-zinc-300 px-6 text-lg font-semibold"
          >
            계정 바꾸기
          </button>
        </form>
      </div>
    </main>
  );
}
