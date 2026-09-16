import Link from "next/link";

type Role = "staff" | "owner";

// 실제 화면이 아직 대부분 없다(T-021/T-026/T-051/T-061 등 미착수) — 링크는
// 앞으로 만들 라우트를 미리 가리킨다. 이 컴포넌트의 핵심은 "역할별로 다른
// 메뉴가 뜬다"는 구조이지, 지금 모든 링크가 살아있는 것이 아니다.
//
// 경로는 각 화면 작업 문서(T-020/T-021/T-026/T-051/T-084/T-085)의
// "주요 위치"와 정확히 맞춘다 — 사장님 전용 화면은 전부 /owner/... 아래에
// 있어야 proxy.ts의 라우트 가드(matcher: "/owner/:path+")가 걸린다.
const INVOICE_ITEMS = [
  { href: "/invoices/new", label: "새 송장 만들기" },
  { href: "/invoices/drafts", label: "임시 송장 목록" },
  { href: "/invoices", label: "확정 송장 목록" },
];

const STAFF_ITEMS = [...INVOICE_ITEMS, { href: "/notifications", label: "알림" }];

const OWNER_ITEMS = [
  ...INVOICE_ITEMS,
  { href: "/owner/notifications", label: "알림" },
  { href: "/owner/settlements", label: "정산 목록" },
  { href: "/owner/prices", label: "월별 단가" },
  { href: "/owner/clients", label: "원청 관리" },
  { href: "/owner/items", label: "품목 관리" },
  { href: "/owner/settings/staff", label: "직원 계정 관리" },
  { href: "/owner/settings/factory", label: "공장 설정" }, // T-019, 아직 blocked(T-001 필요) — 자리만 만들어 둠
];

const LINK_CLASS =
  "flex h-14 items-center rounded-lg px-4 text-lg font-medium text-foreground hover:bg-black/5";

export function Nav({ role }: { role: Role }) {
  const items = role === "owner" ? OWNER_ITEMS : STAFF_ITEMS;

  return (
    <nav className="flex w-full max-w-sm flex-col gap-1" aria-label="메뉴">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={LINK_CLASS}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
