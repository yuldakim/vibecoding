import { redirect } from "next/navigation";
import { getSessionForRole } from "@/lib/auth/session-guard";
import { getNotificationsForRole } from "@/lib/notifications/queries";

// §22 직원 알림 3종 — 이 화면에 표시할 유일한 종류다. kind가 다른 값이면
// (예: 사장님 전용 7종) target_role이 잘못 들어갔더라도 화면에 안 보인다.
const LABELS: Record<string, string> = {
  staff_owner_review_needed: "사장님 정산 확인 필요",
  staff_auto_send_upcoming: "자동 발송 예정일",
  staff_send_failed: "정산서 발송 실패",
};

export const dynamic = "force-dynamic";

export default async function StaffNotificationsPage() {
  const session = await getSessionForRole("staff");
  if (!session) redirect("/select");

  const all = await getNotificationsForRole("staff");
  const items = all.filter((n) => n.kind in LABELS);

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">알림</h1>
      {items.length === 0 ? (
        <p className="text-lg text-zinc-600">새 알림이 없습니다.</p>
      ) : (
        <ul className="flex w-full max-w-sm flex-col gap-3">
          {items.map((n) => (
            <li key={n.id} className="rounded-lg border border-border px-4 py-3 text-lg">
              {LABELS[n.kind]}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
