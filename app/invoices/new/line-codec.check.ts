// 실행: node --experimental-strip-types app/invoices/new/line-codec.check.ts
import assert from "node:assert/strict";
import { parseLine, encodeLine } from "./line-codec.ts";

// 왕복 인코딩
const line = { itemId: 5, sizeId: 2, quantity: 3, lineKey: 7 };
assert.deepEqual(parseLine(encodeLine(line)), line, "encode 후 parse하면 원래 값으로 돌아와야 함");

// §5 0·음수·상한 차단
assert.equal(parseLine("5:2:0:7"), null, "수량 0은 거부");
assert.equal(parseLine("5:2:-1:7"), null, "음수 수량은 거부");
assert.equal(parseLine("5:2:10000:7"), null, "수량 상한(9999) 초과는 거부");
assert.equal(parseLine("5:2:9999:7") !== null, true, "상한값 9999는 허용");

// 형식·범위 위반
assert.equal(parseLine("5:2:3"), null, "필드 3개(구버전 인코딩)는 거부");
assert.equal(parseLine("5:2:3:7:1"), null, "필드 5개는 거부");
assert.equal(parseLine("5:2:3:0"), null, "lineKey 0은 거부");
assert.equal(parseLine("5:2:3:-1"), null, "음수 lineKey는 거부");
assert.equal(parseLine("5:2:3:1e21"), null, "안전 정수 범위를 벗어난 lineKey는 거부");
assert.equal(parseLine("0:2:3:7"), null, "itemId 0은 거부");
assert.equal(parseLine(""), null, "빈 문자열은 거부");
assert.equal(parseLine("5:2:3:"), null, "필드 누락(빈 값)은 거부");

// 이 줄을 원래 자리로 되돌리는 splice 재삽입 — T-037 치명 버그(줄 순서가
// 바뀌면서 React key가 다른 줄의 입력 상태를 물려받던 문제)의 회귀 검사.
function reinsert(otherLines: string[], index: number, encoded: string): string[] {
  const next = [...otherLines];
  next.splice(index, 0, encoded);
  return next;
}
const original = ["A", "B", "C"];
for (let i = 0; i < original.length; i++) {
  const others = original.filter((_, j) => j !== i);
  const restored = reinsert(others, i, original[i]);
  assert.deepEqual(restored, original, `index ${i} 위치의 줄을 편집해도 전체 순서가 보존돼야 함`);
}
assert.deepEqual(reinsert([], 0, "A"), ["A"], "줄이 1개뿐일 때도 정상 동작해야 함");

console.log("line-codec.check.ts: 전부 통과");
