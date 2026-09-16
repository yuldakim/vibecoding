type Role = "staff" | "owner";

/**
 * 직원에게 보낼 응답에서 금액 필드를 완전히 제거한다 — 값을 지우는 게
 * 아니라 키 자체를 없앤다. 네트워크 탭에 필드가 존재만 해도 실패다
 * (.claude/rules/코드-작성.md).
 *
 * **얕은 delete만 한다.** `fields`에 넘긴 최상위 키만 지운다 — 중첩 객체나
 * 배열 안의 금액(예: 정산 상세의 `settlement_lines[].applied_unit_price`)은
 * 이 함수를 거쳐도 그대로 남는다. 중첩 구조를 가진 응답에는 재귀로 이 함수를
 * 확장하지 말고, 애초에 직원 세션일 때는 그 컬럼을 select하지 않는 것으로
 * 막는다(가장 확실한 방어선은 쿼리 단계다).
 */
export function redactMoneyFields<T extends object>(
  data: T,
  fields: (keyof T)[],
  role: Role,
): Partial<T> {
  if (role === "owner") return data;
  const copy: Partial<T> = { ...data };
  for (const field of fields) {
    delete copy[field];
  }
  return copy;
}
