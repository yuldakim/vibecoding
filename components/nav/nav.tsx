import Link from "next/link";

type Role = "staff" | "owner";

// 실제 화면이 아직 대부분 없다(T-021/T-026/T-051/T-061 등 미착수) — 링크는
// 앞으로 만들 라우트를 미리 가리킨다. 이 컴포넌트의 핵심은 "역할별로 다른
// 메뉴가 뜬다"는 구조이지, 지금 모든 링크가 살아있는 것이 아니다.
const STAFF_ITEMS = [
  { href: "/invoices/new", label: "새 송장 만들기" },
  { href: "/invoices/drafts", label: "임시 송장 목록" },
  { href: "/invoices", label: "확정 송장 목록" },
  { href: "/notifications", label: "알림" },
];

const OWNER_ITEMS = [
  { href: "/settlements", label: "정산 목록" },
  { href: "/prices", label: "월별 단가" },
  { href: "/clients", label: "원청 관리" },
  { href: "/items", label: "품목 관리" },
  { href: "/settings", label: "공장 설정" },
];

const LINK_CLASS =
  "flex h-14 items-center rounded-lg px-4 text-lg font-medium text-foreground hover:bg-black/5";

export function Nav({ role }: { role: Role }) {
  const items = role === "owner" ? [...STAFF_ITEMS, ...OWNER_ITEMS] : STAFF_ITEMS;

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
