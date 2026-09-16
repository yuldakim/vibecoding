import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";
// ponytail: 고정 12시간 만료. 활동 중 자동 갱신은 T-014/T-018에서 필요해지면 추가.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type SessionPayload =
  | { role: "staff"; staffId: number; exp: number }
  | { role: "owner"; exp: number };
type SessionInput = { role: "staff"; staffId: number } | { role: "owner" };

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  // 빈 문자열은 undefined와 달리 조용히 HMAC을 계산해버려 누구나 서명을
  // 위조할 수 있게 된다(fail-open). 길이까지 검사해 fail-closed로 막는다.
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET이 설정되지 않았거나 너무 짧습니다(32자 이상 필요).");
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function encodeSession(payload: SessionInput): string {
  const full: SessionPayload = { ...payload, exp: Date.now() + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(cookieValue: string | undefined): SessionPayload | null {
  if (!cookieValue) return null;
  const [data, sig] = cookieValue.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
