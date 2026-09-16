// 실행: node --experimental-strip-types lib/notifications/rules.check.ts
import assert from "node:assert/strict";
import {
  shouldNotifyPriceMissing,
  shouldNotifyPriceCheckRequestNeeded,
  shouldNotifyFinalReviewNeeded,
  shouldNotifyRevisionReviewNeeded,
  shouldNotifyApprovedAwaitingSend,
  shouldNotifySendDatePassed,
  shouldNotifyEmailFailed,
  shouldNotifyStaffOwnerReviewNeeded,
  shouldNotifyStaffAutoSendUpcoming,
  shouldNotifyStaffSendFailed,
} from "./rules.ts";
import { shouldCreateNotification } from "./dedupe.ts";

// 사장님 7종
assert.equal(shouldNotifyPriceMissing(3), true);
assert.equal(shouldNotifyPriceMissing(0), false);

assert.equal(shouldNotifyPriceCheckRequestNeeded(3, false), true);
assert.equal(shouldNotifyPriceCheckRequestNeeded(3, true), false, "요청 이미 보냈으면 재알림 안 함");
assert.equal(shouldNotifyPriceCheckRequestNeeded(0, false), false);

assert.equal(shouldNotifyFinalReviewNeeded({ status: "pending_review", revisionNo: 0 }), true);
assert.equal(shouldNotifyFinalReviewNeeded({ status: "needs_reapproval", revisionNo: 0 }), true, "최초 정산서가 승인 취소돼도 최초본 확인 알림이다(수정 정산서 아님)");
assert.equal(shouldNotifyFinalReviewNeeded({ status: "pending_review", revisionNo: 1 }), false, "수정본은 별도 알림으로 간다");
assert.equal(shouldNotifyFinalReviewNeeded({ status: "approved", revisionNo: 0 }), false);

assert.equal(shouldNotifyRevisionReviewNeeded({ status: "needs_reapproval", revisionNo: 1 }), true);
assert.equal(shouldNotifyRevisionReviewNeeded({ status: "pending_review", revisionNo: 1 }), true);
assert.equal(shouldNotifyRevisionReviewNeeded({ status: "needs_reapproval", revisionNo: 0 }), false, "revisionNo=0은 수정 정산서가 아니라 최초 정산서다");
assert.equal(shouldNotifyRevisionReviewNeeded({ status: "pending_review", revisionNo: 0 }), false);

assert.equal(shouldNotifyApprovedAwaitingSend({ status: "approved", sentAt: null }), true);
assert.equal(shouldNotifyApprovedAwaitingSend({ status: "approved", sentAt: "2026-07-01T00:00:00Z" }), false);
assert.equal(shouldNotifyApprovedAwaitingSend({ status: "draft", sentAt: null }), false);

const today = new Date("2026-07-10T00:00:00Z");
assert.equal(
  shouldNotifySendDatePassed({ sendScheduledDate: "2026-07-05", sentAt: null }, today),
  true,
);
assert.equal(
  shouldNotifySendDatePassed({ sendScheduledDate: "2026-07-20", sentAt: null }, today),
  false,
);
assert.equal(
  shouldNotifySendDatePassed({ sendScheduledDate: "2026-07-05", sentAt: "2026-07-06T00:00:00Z" }, today),
  false,
  "이미 발송했으면 경과 알림 안 함",
);

// 시간대 경계: send_scheduled_date는 KST 달력 날짜다. UTC 자정으로 잘못
// 비교하면 발송일 "당일" 오전 9시(KST)부터 이미 지난 것처럼 계산된다.
assert.equal(
  shouldNotifySendDatePassed(
    { sendScheduledDate: "2026-07-25", sentAt: null },
    new Date("2026-07-25T00:01:00Z"), // = 2026-07-25 09:01 KST, 발송일 당일 오전
  ),
  false,
  "발송일 당일 KST 오전이면 아직 안 지났다",
);
assert.equal(
  shouldNotifySendDatePassed(
    { sendScheduledDate: "2026-07-25", sentAt: null },
    new Date("2026-07-25T15:30:00Z"), // = 2026-07-26 00:30 KST, 다음 날
  ),
  true,
  "발송일 다음 날 KST가 되면 지났다",
);
assert.equal(
  shouldNotifyStaffAutoSendUpcoming("2026-07-25", null, new Date("2026-07-25T00:01:00Z")),
  true,
  "발송일 당일 KST 오전에도 아직 표시 대상(daysUntil=0)이어야 한다",
);
assert.equal(
  shouldNotifyStaffAutoSendUpcoming("2026-07-25", null, new Date("2026-07-25T15:30:00Z")),
  false,
  "발송일 다음 날 KST가 되면(daysUntil=-1) 사라져야 한다",
);

assert.equal(shouldNotifyEmailFailed({ success: false, resolvedAt: null }), true);
assert.equal(shouldNotifyEmailFailed({ success: false, resolvedAt: "2026-07-06T00:00:00Z" }), false, "재발송 성공하면 해제");
assert.equal(shouldNotifyEmailFailed({ success: true, resolvedAt: null }), false);

// 직원 3종
assert.equal(shouldNotifyStaffOwnerReviewNeeded("pending_review"), true);
assert.equal(shouldNotifyStaffOwnerReviewNeeded("needs_reapproval"), true);
assert.equal(shouldNotifyStaffOwnerReviewNeeded("sent"), false);

assert.equal(shouldNotifyStaffAutoSendUpcoming("2026-07-15", null, today), true, "5일 남음 → 7일 이내");
assert.equal(shouldNotifyStaffAutoSendUpcoming("2026-07-25", null, today), false, "15일 남음 → 아직");
assert.equal(shouldNotifyStaffAutoSendUpcoming("2026-07-15", "2026-07-11T00:00:00Z", today), false, "이미 발송");
assert.equal(shouldNotifyStaffAutoSendUpcoming("2026-07-08", null, today), false, "이미 지남(발송 경과 쪽 알림 몫)");

assert.equal(shouldNotifyStaffSendFailed(false, null), true);
assert.equal(shouldNotifyStaffSendFailed(true, null), false);

// 중복 방지
const existing = [{ kind: "owner_price_missing", ref_type: "client", ref_id: 1, is_resolved: false }];
assert.equal(
  shouldCreateNotification(existing, { kind: "owner_price_missing", ref_type: "client", ref_id: 1 }),
  false,
  "같은 미해결 알림이 있으면 또 안 만듦",
);
assert.equal(
  shouldCreateNotification(existing, { kind: "owner_price_missing", ref_type: "client", ref_id: 2 }),
  true,
  "다른 원청이면 별도 알림",
);
const resolved = [{ kind: "owner_price_missing", ref_type: "client", ref_id: 1, is_resolved: true }];
assert.equal(
  shouldCreateNotification(resolved, { kind: "owner_price_missing", ref_type: "client", ref_id: 1 }),
  true,
  "이전 알림이 해제됐으면 다시 만들 수 있음",
);

console.log("rules.check.ts: 10종 + 중복방지 전부 통과");
