import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { logoutOwner } from "@/app/(auth)/owner/actions";

export default async function OwnerHomePage() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "owner") redirect("/owner");

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">사장님 홈 — 준비 중</h1>
      <form action={logoutOwner}>
        <button
          type="submit"
          className="h-14 rounded-lg border border-zinc-300 px-6 text-lg font-semibold"
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}
