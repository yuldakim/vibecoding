import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { logoutOwner } from "@/app/(auth)/owner/actions";
import { Nav } from "@/components/nav/nav";

export default async function OwnerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");
  const { passwordChanged } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">사장님 홈 — 준비 중</h1>
      {passwordChanged && <p className="text-lg text-primary">비밀번호를 바꿨습니다.</p>}
      <Nav role="owner" />
      <div className="flex gap-3">
        <Link href="/owner-home/password" className="flex h-14 items-center rounded-lg border border-zinc-300 px-6 text-lg font-semibold">
          비밀번호 변경
        </Link>
        <Link href="/home" className="flex h-14 items-center rounded-lg border border-zinc-300 px-6 text-lg font-semibold">
          직원 화면 보기
        </Link>
        <form action={logoutOwner}>
          <button
            type="submit"
            className="h-14 rounded-lg border border-zinc-300 px-6 text-lg font-semibold"
          >
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
