#!/usr/bin/env node
/**
 * PostToolUse(Write|Edit) hook: 방금 쓴 코드 파일의 줄 수를 한도와 견준다.
 *
 * 한도는 .claude/code-limits.json에 영역별로 둔다. 경고선(기본 85%)을 넘으면
 * 알리고, 한도를 넘으면 exit 2로 에이전트를 다시 깨워 쪼개도록 요구한다.
 * 파일이 길어진 뒤 한꺼번에 나누는 것보다 그 자리에서 잡는 편이 싸다.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function readStdin() {
  try { return JSON.parse(readFileSync(0, "utf8")); } catch { return null; }
}
/** glob(**, *)을 정규식으로 바꾼다. **는 경로 구분자를 넘고 *는 넘지 않는다. */
function globToRe(g) {
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") { re += ".*"; i++; if (g[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}

const input = readStdin();
const raw = input?.tool_response?.filePath ?? input?.tool_input?.file_path ?? "";
if (!raw) process.exit(0);

const abs = resolve(ROOT, raw);
const rel = relative(ROOT, abs);
if (rel.startsWith("..")) process.exit(0);          // 프로젝트 밖
if (!CODE_EXT.test(rel)) process.exit(0);           // 코드 파일만
if (!existsSync(abs)) process.exit(0);

const cfgPath = join(ROOT, ".claude/code-limits.json");
if (!existsSync(cfgPath)) process.exit(0);
let cfg;
try { cfg = JSON.parse(readFileSync(cfgPath, "utf8")); } catch { process.exit(0); }

const rule = (cfg.rules ?? []).find((r) => globToRe(r.pattern).test(rel));
if (!rule || !rule.max) process.exit(0);            // max 0 = 제한 없음

const text = readFileSync(abs, "utf8");
// 끝의 개행은 줄을 하나 더 만들지 않는다 (wc -l과 같게 센다)
const lines = text.length === 0 ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
const max = rule.max;
const warnAt = Math.ceil(max * (cfg.warn_ratio ?? 0.85));
const pct = Math.round((lines / max) * 100);

if (lines > max) {
  console.error(
    `${rel}이(가) ${lines}줄로 한도 ${max}줄을 넘었다 (${pct}%).\n` +
    `이 파일은 다시 작업한다. 지금 상태로 두지 말고 아래 중 하나로 줄인다:\n` +
    `  - 독립적인 관심사를 별도 파일로 분리한다\n` +
    `  - 반복되는 블록을 함수나 컴포넌트로 묶는다\n` +
    `  - 이 파일이 두 가지 일을 하고 있다면 둘로 나눈다\n` +
    `한도 근거: ${rule.pattern} → ${max}줄 (${rule.note ?? ""})\n` +
    `한도 자체가 잘못됐다고 판단되면 임의로 넘기지 말고 사용자에게 조정을 요청한다.`
  );
  process.exit(2);
}

if (lines >= warnAt) {
  const msg = `${rel} ${lines}/${max}줄 (${pct}%) — 한도에 가깝다`;
  console.log(JSON.stringify({
    systemMessage: `⚠️ ${msg}`,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        `${msg}. 남은 여유는 ${max - lines}줄이다. ` +
        `여기서 더 붙이기 전에 분리할 부분이 있는지 본다 (한도 근거: ${rule.pattern}).`,
    },
  }));
}
process.exit(0);
