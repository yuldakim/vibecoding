// 설계.md §22 — 사장님 7종 + 직원 3종 알림의 생성 조건.
// 직원 알림 함수는 파라미터·반환값에 금액 필드가 없다(컴파일 타임 방어).

import { toKstDateString, daysBetween } from "../date/kst.ts";

type SettlementState = { status: string; sentAt: string | null };

export function shouldNotifyPriceMissing(missingPriceCount: number): boolean {
  return missingPriceCount > 0;
}

export function shouldNotifyPriceCheckRequestNeeded(
  missingPriceCount: number,
  requestAlreadySent: boolean,
): boolean {
  return missingPriceCount > 0 && !requestAlreadySent;
}

/** §16 최초 정산서(revisionNo=0)가 사장님 확인을 기다리는 경우. */
export function shouldNotifyFinalReviewNeeded(settlement: {
  status: string;
  revisionNo: number;
}): boolean {
  return (
    settlement.revisionNo === 0 &&
    (settlement.status === "pending_review" || settlement.status === "needs_reapproval")
  );
}

/** §21 수정 정산서(revisionNo>0)가 사장님 확인을 기다리는 경우. */
export function shouldNotifyRevisionReviewNeeded(settlement: {
  status: string;
  revisionNo: number;
}): boolean {
  return (
    settlement.revisionNo > 0 &&
    (settlement.status === "pending_review" || settlement.status === "needs_reapproval")
  );
}

export function shouldNotifyApprovedAwaitingSend(settlement: SettlementState): boolean {
  return settlement.status === "approved" && !settlement.sentAt;
}

export function shouldNotifySendDatePassed(
  settlement: { sendScheduledDate: string; sentAt: string | null },
  today: Date,
): boolean {
  if (settlement.sentAt) return false;
  return daysBetween(settlement.sendScheduledDate, toKstDateString(today)) < 0;
}

export function shouldNotifyEmailFailed(emailLog: {
  success: boolean;
  resolvedAt: string | null;
}): boolean {
  return !emailLog.success && !emailLog.resolvedAt;
}

// 직원 3종 — 아래 함수들의 파라미터·반환값에 단가·금액은 존재하지 않는다.
//
// "발송 예정일 7일 전부터 표시"(§22)는 날짜 카운트다운형인
// shouldNotifyStaffAutoSendUpcoming에만 적용한다. 나머지 둘(사장님 정산
// 확인 필요·발송 실패)은 사건 발생형이라 발생하는 즉시 표시해야 하고
// 7일 창을 적용할 날짜 자체가 없다 — 그래서 이 두 함수는 날짜 파라미터를
// 받지 않는다(설계상 선택, 실수로 빠뜨린 게 아니다).

export function shouldNotifyStaffOwnerReviewNeeded(settlementStatus: string): boolean {
  return settlementStatus === "pending_review" || settlementStatus === "needs_reapproval";
}

/** §22: "직원 알림은 원청별 발송 예정일 7일 전부터 표시한다." */
export function shouldNotifyStaffAutoSendUpcoming(
  sendScheduledDate: string,
  sentAt: string | null,
  today: Date,
): boolean {
  if (sentAt) return false;
  const daysUntil = daysBetween(sendScheduledDate, toKstDateString(today));
  return daysUntil >= 0 && daysUntil <= 7;
}

export function shouldNotifyStaffSendFailed(success: boolean, resolvedAt: string | null): boolean {
  return !success && !resolvedAt;
}
