// 실행: node --experimental-strip-types lib/auth/authorize.check.ts
// (session-guard.ts는 next/headers를 쓰므로 Next 런타임 밖에서 못 돈다 —
//  여기서는 Next 의존성 없는 순수 로직만 검증한다: authorize.ts, redact.ts,
//  session.ts의 encode/decodeSession 왕복)
import assert from "node:assert/strict";
import { encodeSession, decodeSession } from "./session.ts";
import { satisfiesRole } from "./authorize.ts";
import { redactMoneyFields } from "./redact.ts";

process.env.SESSION_SECRET = "x".repeat(32);

const staffSession = decodeSession(encodeSession({ role: "staff", staffId: 1 }));
const ownerSession = decodeSession(encodeSession({ role: "owner" }));

assert.equal(satisfiesRole(staffSession, "staff"), true, "staff 세션은 staff 요구를 통과해야 함");
assert.equal(satisfiesRole(staffSession, "owner"), false, "staff 세션은 owner 요구를 통과하면 안 됨");
assert.equal(satisfiesRole(ownerSession, "staff"), true, "owner 세션은 staff 요구도 통과해야 함(사장님=직원 권한 포함)");
assert.equal(satisfiesRole(ownerSession, "owner"), true, "owner 세션은 owner 요구를 통과해야 함");
assert.equal(satisfiesRole(null, "staff"), false, "세션 없으면 항상 거부");

const settlement = { id: 1, clientName: "이불나라", totalAmount: 100000, vatAmount: 10000 };
const forStaff = redactMoneyFields(settlement, ["totalAmount", "vatAmount"], "staff");
assert.equal("totalAmount" in forStaff, false, "staff 응답엔 totalAmount 키 자체가 없어야 함");
assert.equal("vatAmount" in forStaff, false, "staff 응답엔 vatAmount 키 자체가 없어야 함");
assert.equal(forStaff.clientName, "이불나라", "금액 아닌 필드는 그대로 남아야 함");
const forOwner = redactMoneyFields(settlement, ["totalAmount", "vatAmount"], "owner");
assert.equal(forOwner.totalAmount, 100000, "owner 응답은 금액이 그대로여야 함");

console.log("authorize.check.ts: 전부 통과");
