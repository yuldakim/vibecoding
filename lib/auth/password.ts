import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * 형식이 "salt:hex"가 아니면(예: 시드값 'unset') 항상 거부한다.
 *
 * hex 부분을 엄격히 검증한다 — `Buffer.from(잘못된hex, "hex")`는 에러 없이
 * 빈 버퍼를 반환하고, 그 길이를 그대로 scrypt 출력 길이로 쓰면(구버전 버그)
 * `scryptSync(plain, salt, 0)`도 빈 버퍼가 되어 `timingSafeEqual(빈,빈)`이
 * true를 반환한다 — 즉 저장된 해시가 손상되면 아무 비밀번호나 통과한다.
 * 항상 고정 길이(KEY_LEN)로 비교해 이 경로를 막는다.
 */
export function verifyPassword(plain: string, hash: string): boolean {
  const parts = hash.split(":");
  if (parts.length !== 2) return false;
  const [salt, derivedHex] = parts;
  if (!/^[0-9a-f]+$/i.test(derivedHex) || derivedHex.length !== KEY_LEN * 2) return false;
  const derived = Buffer.from(derivedHex, "hex");
  const candidate = scryptSync(plain, salt, KEY_LEN);
  return timingSafeEqual(candidate, derived);
}
