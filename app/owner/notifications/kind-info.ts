// 설계.md §22 사장님 알림 7종 — 화면 표시용 라벨·바로가기·우선순위.
// 순서 기준(설계 문서가 못박지 않아 임의로 정함): 이미 지연·실패 중인 것을
// 단가처럼 아직 여유 있는 준비 단계보다 위로 둔다.
export const OWNER_KIND_INFO: Record<string, { label: string; href: string; priority: number }> = {
  owner_send_date_passed: { label: "발송 예정일 경과", href: "/owner/settlements", priority: 1 },
  owner_email_failed: { label: "이메일 발송 실패", href: "/owner/settlements", priority: 2 },
  owner_revision_review_needed: { label: "수정 정산서 확인 필요", href: "/owner/settlements", priority: 3 },
  owner_final_review_needed: { label: "정산서 최종 확인 필요", href: "/owner/settlements", priority: 4 },
  owner_approved_awaiting_send: { label: "승인 후 발송 대기", href: "/owner/settlements", priority: 5 },
  owner_price_check_request_needed: { label: "단가 확인 요청서 발송 필요", href: "/owner/prices", priority: 6 },
  owner_price_missing: { label: "단가 미정 품목 존재", href: "/owner/prices", priority: 7 },
};

export function ownerKindLabel(kind: string): string {
  return OWNER_KIND_INFO[kind]?.label ?? kind;
}
