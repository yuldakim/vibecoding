import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { logoutOwner } from "@/app/(auth)/owner/actions";

export default async function OwnerHomePage() {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

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
