import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { getNotificationsForRole } from "@/lib/notifications/queries";
import { Button } from "@/components/ui/button";
import { OWNER_KIND_INFO, ownerKindLabel } from "./kind-info";
import { resolveNotification } from "./actions";

export const dynamic = "force-dynamic";

export default async function OwnerNotificationsPage() {
  const session = await getSessionForRole("owner");
  if (!session) redirect("/owner");

  const notifications = await getNotificationsForRole("owner");
  const sorted = [...notifications].sort(
    (a, b) => (OWNER_KIND_INFO[a.kind]?.priority ?? 99) - (OWNER_KIND_INFO[b.kind]?.priority ?? 99),
  );

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">알림 ({sorted.length})</h1>
      {sorted.length === 0 && <p className="text-lg text-zinc-600">처리할 알림이 없습니다.</p>}
      <ul className="flex w-full max-w-xl flex-col gap-3">
        {sorted.map((n) => {
          const info = OWNER_KIND_INFO[n.kind];
          return (
            <li key={n.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <Link href={info?.href ?? "/owner-home"} className="text-lg font-semibold hover:underline">
                {ownerKindLabel(n.kind)}
              </Link>
              <form action={resolveNotification}>
                <input type="hidden" name="id" value={n.id} />
                <Button type="submit" variant="secondary">
                  확인
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
