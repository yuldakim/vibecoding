import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { logoutStaff } from "@/app/(auth)/staff/actions";

export default async function StaffHomePage() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "staff") redirect("/staff");

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">직원 홈 — 준비 중</h1>
      <form action={logoutStaff}>
        <button
          type="submit"
          className="h-14 rounded-lg border border-zinc-300 px-6 text-lg font-semibold"
        >
          계정 바꾸기
        </button>
      </form>
    </main>
  );
}
