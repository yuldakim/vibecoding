#!/usr/bin/env node
/**
 * backlog.mjs — 이불공장 납품·정산 관리 사이트 백로그 CLI.
 *
 * 대상 파일: 이 스크립트 상위 폴더의 backlog.json (BACKLOG_FILE 환경변수로 변경 가능).
 * 의존성 없음. `node tools/backlog.mjs --help`로 사용법을 본다.
 *
 * 원칙
 *   - backlog.json은 손으로 고치지 않고 이 도구로만 바꾼다.
 *   - 모든 쓰기 전에 검증하고, 검증에 실패하면 파일을 건드리지 않는다.
 *   - task.doc은 항상 docs/tasks/<id>.md다. id에서 유도되지 않으면 검증이 막는다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = process.env.BACKLOG_FILE
  ? resolve(process.env.BACKLOG_FILE)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..", "backlog.json");
const ROOT = dirname(FILE);

const TERMINAL = new Set(["done", "cancelled"]);
const ACTIVE = ["in_progress", "review", "needs_decision", "blocked", "todo"];
/** 목록 정렬용 상태 우선순위. 손이 가야 하는 것부터 위로 올린다. */
const STATUS_ORDER = ["in_progress", "review", "needs_decision", "blocked", "todo", "done", "cancelled"];
/** 표 정렬이 깨지지 않도록 상태마다 2글자 라벨을 쓴다. */
const SHORT = { todo: "할일", in_progress: "진행", review: "리뷰", needs_decision: "판단", blocked: "대기", done: "완료", cancelled: "취소" };
/** 상태 변경 시 사유(note)를 반드시 요구하는 상태. */
const NEEDS_NOTE = new Set(["blocked", "needs_decision", "cancelled"]);
const EDITABLE = ["title", "summary", "priority", "category", "phase", "where", "note", "estimate", "deps", "refs"];

// ─────────────────────────────── 출력 유틸 ───────────────────────────────

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
};
function c(name, s) { return USE_COLOR && C[name] ? C[name] + s + C.reset : String(s); }
const STATUS_COLOR = { todo: "reset", in_progress: "cyan", review: "magenta", needs_decision: "yellow", blocked: "red", done: "green", cancelled: "dim" };

/** 한글·이모지는 터미널에서 두 칸을 차지한다. 표 정렬을 위해 실제 표시 폭을 센다. */
function charWidth(cp) {
  if (cp >= 0x1100 && (
    cp <= 0x115f ||
    cp === 0x2329 || cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff)
  )) return 2;
  return 1;
}
function width(s) { let n = 0; for (const ch of String(s)) n += charWidth(ch.codePointAt(0)); return n; }
function pad(s, w) { const d = w - width(s); return d > 0 ? s + " ".repeat(d) : String(s); }
function trunc(s, max) {
  s = String(s);
  if (width(s) <= max) return s;
  let out = "", n = 0;
  for (const ch of s) {
    const cw = charWidth(ch.codePointAt(0));
    if (n + cw > max - 1) break;
    out += ch; n += cw;
  }
  return out + "…";
}
function fail(msg) { console.error(c("red", "오류: ") + msg); process.exit(1); }
function today() { return new Date().toLocaleDateString("sv-SE"); } // YYYY-MM-DD (로컬 기준)

// ─────────────────────────────── 파일 입출력 ───────────────────────────────

function read() {
  if (!existsSync(FILE)) fail(`백로그 파일이 없다: ${FILE}`);
  let bl;
  try { bl = JSON.parse(readFileSync(FILE, "utf8")); }
  catch (e) { fail(`backlog.json을 읽을 수 없다 (JSON 형식 오류): ${e.message}`); }
  if (!bl || !Array.isArray(bl.tasks)) fail("backlog.json에 tasks 배열이 없다.");
  return bl;
}

/** 검증을 통과할 때만 저장한다. 임시 파일에 쓴 뒤 교체해 중간에 끊겨도 원본이 깨지지 않게 한다. */
function write(bl) {
  const { errors } = validate(bl);
  if (errors.length) {
    console.error(c("red", "검증에 실패해 저장하지 않았다:"));
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  bl.meta.updated = today();
  const tmp = FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(bl, null, 2) + "\n");
  renameSync(tmp, FILE);
}

function docPath(bl, id) { return `${bl.meta.doc_dir}/${id}.md`; }

// ─────────────────────────────── 검증 ───────────────────────────────

const REQUIRED = ["id", "title", "summary", "doc", "status", "priority", "category", "phase", "estimate_min", "deps"];

/** backlog.json 전체를 스키마·enum·참조·문서 존재 기준으로 본다. errors는 저장을 막고 warns는 알리기만 한다. */
function validate(bl) {
  const errors = [], warns = [];
  const enums = bl.enums ?? {};
  const byId = new Map(bl.tasks.map((t) => [t.id, t]));
  if (byId.size !== bl.tasks.length) {
    const seen = new Set(), dup = new Set();
    for (const t of bl.tasks) { if (seen.has(t.id)) dup.add(t.id); seen.add(t.id); }
    errors.push(`중복 id: ${[...dup].join(", ")}`);
  }
  for (const t of bl.tasks) {
    const id = t.id ?? "(id 없음)";
    for (const f of REQUIRED) if (t[f] === undefined) errors.push(`${id}: 필수 필드 없음 '${f}'`);
    if (!/^T-\d{3}$/.test(t.id ?? "")) errors.push(`${id}: id 형식은 T-000이어야 한다`);
    if (!enums.status?.includes(t.status)) errors.push(`${id}: 잘못된 status '${t.status}'`);
    if (!enums.category?.includes(t.category)) errors.push(`${id}: 잘못된 category '${t.category}'`);
    if (!enums.priority?.includes(t.priority ?? null)) errors.push(`${id}: 잘못된 priority '${t.priority}'`);
    if (!bl.phases?.includes(t.phase)) errors.push(`${id}: 미등록 phase '${t.phase}'`);
    if (!String(t.title ?? "").trim()) errors.push(`${id}: 제목이 비었다`);
    if (!String(t.summary ?? "").trim()) errors.push(`${id}: 설명이 비었다`);
    if (!Number.isInteger(t.estimate_min) || t.estimate_min <= 0) errors.push(`${id}: estimate_min은 양의 정수여야 한다`);
    if (t.doc !== docPath(bl, t.id)) errors.push(`${id}: doc은 ${docPath(bl, t.id)}여야 한다 (현재 '${t.doc}')`);
    else if (!existsSync(join(ROOT, t.doc))) warns.push(`${id}: 상세 문서가 없다 — ${t.doc}`);
    if (TERMINAL.has(t.status) && !t.done_at) errors.push(`${id}: ${t.status}인데 done_at이 없다`);
    if (!TERMINAL.has(t.status) && t.done_at) errors.push(`${id}: ${t.status}인데 done_at이 남아 있다`);
    if (t.done_at && !/^\d{4}-\d{2}-\d{2}$/.test(t.done_at)) errors.push(`${id}: done_at 날짜 형식이 아니다 '${t.done_at}'`);
    if (NEEDS_NOTE.has(t.status) && !String(t.note ?? "").trim()) errors.push(`${id}: ${t.status}인데 사유(note)가 없다`);
    if (!Array.isArray(t.deps)) { errors.push(`${id}: deps는 배열이어야 한다`); continue; }
    const seen = new Set();
    for (const d of t.deps) {
      if (d === t.id) errors.push(`${id}: 자기 자신을 선행 작업으로 둘 수 없다`);
      else if (!byId.has(d)) errors.push(`${id}: 미존재 선행 작업 '${d}'`);
      if (seen.has(d)) errors.push(`${id}: 중복 선행 작업 '${d}'`);
      seen.add(d);
    }
  }
  // 선행 작업 순환 (DFS)
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const dfs = (id, stack) => {
    color.set(id, GRAY);
    for (const d of byId.get(id)?.deps ?? []) {
      if (!byId.has(d)) continue;
      const st = color.get(d) ?? WHITE;
      if (st === GRAY) errors.push(`선행 작업 순환: ${[...stack, id, d].join(" → ")}`);
      else if (st === WHITE) dfs(d, [...stack, id]);
    }
    color.set(id, BLACK);
  };
  for (const t of bl.tasks) if ((color.get(t.id) ?? WHITE) === WHITE) dfs(t.id, []);

  // 완료인데 선행이 미완료 / 대기인데 선행이 없음 — 막지는 않고 알린다
  for (const t of bl.tasks) {
    if (t.status === "done") {
      const open = (t.deps ?? []).filter((d) => byId.get(d) && byId.get(d).status !== "done");
      if (open.length) warns.push(`${t.id}: 완료인데 선행 작업이 미완료 — ${open.join(", ")}`);
    }
    if (t.status === "blocked" && !(t.deps ?? []).length) warns.push(`${t.id}: 대기인데 선행 작업이 없다 (사유만 있다)`);
  }
  // 백로그에 없는 고아 문서
  const dir = join(ROOT, bl.meta.doc_dir);
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
    const orphan = files.filter((f) => !byId.has(f));
    if (orphan.length) warns.push(`백로그에 없는 문서: ${orphan.join(", ")}`);
  }
  return { errors, warns };
}

// ─────────────────────────────── 값 해석 ───────────────────────────────

/** "56", "t-056", "T-056" 을 모두 T-056으로 받는다. */
function resolveTask(bl, input) {
  if (!input) fail("작업 id가 필요하다.");
  const raw = String(input).trim();
  const byId = new Map(bl.tasks.map((t) => [t.id, t]));
  if (byId.has(raw)) return byId.get(raw);
  const upper = raw.toUpperCase();
  if (byId.has(upper)) return byId.get(upper);
  if (/^\d+$/.test(raw)) {
    const padded = "T-" + raw.padStart(3, "0");
    if (byId.has(padded)) return byId.get(padded);
  }
  const hits = bl.tasks.filter((t) => t.title.includes(raw));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) fail(`'${raw}'에 해당하는 작업이 여러 개다:\n` + hits.map((t) => `  ${t.id} ${t.title}`).join("\n"));
  fail(`'${raw}' 작업을 찾을 수 없다.`);
}

/** enum 값·한글 라벨·2글자 약칭을 모두 받는다. (예: in_progress / 작업중 / 진행) */
function resolveStatus(bl, input) {
  const raw = String(input ?? "").trim();
  const list = bl.enums.status;
  if (list.includes(raw)) return raw;
  const labels = bl.labels?.status ?? {};
  for (const s of list) if (labels[s] === raw || SHORT[s] === raw) return s;
  const pre = list.filter((s) => s.startsWith(raw.toLowerCase()));
  if (pre.length === 1) return pre[0];
  fail(`알 수 없는 상태 '${raw}'.\n  가능한 값: ` + list.map((s) => `${s}(${labels[s] ?? SHORT[s]})`).join(", "));
}

/** "송장" 처럼 일부만 적어도 "2. 송장"을 찾아 준다. */
function resolvePhase(bl, input) {
  const raw = String(input ?? "").trim();
  if (bl.phases.includes(raw)) return raw;
  const hits = bl.phases.filter((p) => p.includes(raw));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) fail(`'${raw}'에 해당하는 단계가 여러 개다: ${hits.join(" / ")}`);
  fail(`알 수 없는 단계 '${raw}'.\n  가능한 값: ${bl.phases.join(" / ")}`);
}

function resolveEnum(bl, key, input, label) {
  const raw = String(input ?? "").trim();
  if (bl.enums[key].includes(raw)) return raw;
  fail(`알 수 없는 ${label} '${raw}'.\n  가능한 값: ${bl.enums[key].filter(Boolean).join(", ")}`);
}

/** "1,T-002, 3" → ["T-001","T-002","T-003"] */
function parseDeps(bl, input) {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((s) => resolveTask(bl, s).id);
}

function parseArgs(argv) {
  const positional = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) { flags[key] = next; i++; }
      else flags[key] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

// ─────────────────────────────── 표시 ───────────────────────────────

function statusCell(t) { return c(STATUS_COLOR[t.status] ?? "reset", SHORT[t.status] ?? t.status); }

function sortTasks(bl, tasks) {
  const phaseIdx = (p) => { const i = bl.phases.indexOf(p); return i < 0 ? 999 : i; };
  return [...tasks].sort((a, b) =>
    phaseIdx(a.phase) - phaseIdx(b.phase) ||
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
    a.id.localeCompare(b.id));
}

/** 단계별로 묶어 표로 찍는다. 제목은 터미널 폭에 맞춰 자른다. */
function printTable(bl, tasks) {
  if (!tasks.length) { console.log(c("dim", "  해당하는 작업이 없다.")); return; }
  const term = process.stdout.columns || 100;
  const titleW = Math.max(20, Math.min(60, term - 34));
  let phase = null;
  for (const t of sortTasks(bl, tasks)) {
    if (t.phase !== phase) {
      phase = t.phase;
      const n = tasks.filter((x) => x.phase === phase).length;
      console.log("\n" + c("bold", phase) + c("dim", `  (${n}개)`));
    }
    const deps = (t.deps ?? []).length ? c("dim", "← " + t.deps.map((d) => d.replace("T-", "")).join(",")) : "";
    console.log(
      "  " + c("dim", t.id) +
      "  " + statusCell(t) +
      "  " + c("dim", t.priority ?? "--") +
      "  " + pad(trunc(t.title, titleW), titleW) +
      "  " + deps
    );
  }
}

function summaryLine(bl, tasks) {
  const n = {};
  for (const t of tasks) n[t.status] = (n[t.status] ?? 0) + 1;
  const parts = STATUS_ORDER.filter((s) => n[s]).map((s) => `${bl.labels?.status?.[s] ?? s} ${n[s]}`);
  const mins = tasks.reduce((a, t) => a + (t.estimate_min ?? 0), 0);
  return c("dim", `\n총 ${tasks.length}개 · ${parts.join(" · ")} · 예상 ${(mins / 60).toFixed(1)}시간`);
}

// ─────────────────────────────── 조회 명령 ───────────────────────────────

function cmdList(bl, { flags }) {
  let tasks = bl.tasks;
  if (flags.status) { const s = resolveStatus(bl, flags.status); tasks = tasks.filter((t) => t.status === s); }
  else if (flags.done) tasks = tasks.filter((t) => TERMINAL.has(t.status));
  else if (!flags.all) tasks = tasks.filter((t) => ACTIVE.includes(t.status));
  if (flags.priority) tasks = tasks.filter((t) => t.priority === String(flags.priority).toUpperCase());
  if (flags.category) { const v = resolveEnum(bl, "category", flags.category, "분류"); tasks = tasks.filter((t) => t.category === v); }
  if (flags.phase) { const p = resolvePhase(bl, flags.phase); tasks = tasks.filter((t) => t.phase === p); }
  if (flags.search) { const q = String(flags.search); tasks = tasks.filter((t) => t.title.includes(q) || t.summary.includes(q)); }

  if (flags.json) { console.log(JSON.stringify(sortTasks(bl, tasks), null, 2)); return; }
  printTable(bl, tasks);
  console.log(summaryLine(bl, tasks));
}

function cmdGet(bl, { positional, flags }) {
  const t = resolveTask(bl, positional[0]);
  if (flags.json) { console.log(JSON.stringify(t, null, 2)); return; }
  const byId = new Map(bl.tasks.map((x) => [x.id, x]));
  const L = bl.labels?.status ?? {};
  console.log("\n" + c("bold", `${t.id}  ${t.title}`));
  console.log(c("dim", "─".repeat(Math.min(width(`${t.id}  ${t.title}`), process.stdout.columns || 60))));
  console.log(`  상태      ${c(STATUS_COLOR[t.status], L[t.status] ?? t.status)}`);
  console.log(`  단계      ${t.phase}`);
  console.log(`  분류      ${bl.labels?.category?.[t.category] ?? t.category}   우선순위 ${t.priority ?? "없음"}   예상 ${t.estimate_min}분`);
  if (t.where) console.log(`  위치      ${t.where}`);
  if (t.refs?.length) console.log(`  근거      ${t.refs.join(", ")}`);
  console.log(`  문서      ${t.doc}${existsSync(join(ROOT, t.doc)) ? "" : c("red", "  (파일 없음)")}`);
  if (t.done_at) console.log(`  완료일    ${t.done_at}`);
  console.log(`  수정일    ${t.updated_at ?? "-"}`);
  console.log(`\n  ${t.summary}`);
  if (t.note) console.log(c("yellow", `\n  메모: ${t.note}`));

  const deps = (t.deps ?? []).map((d) => byId.get(d)).filter(Boolean);
  if (deps.length) {
    console.log(c("bold", "\n  선행 작업"));
    for (const d of deps) console.log(`    ${statusCell(d)}  ${c("dim", d.id)}  ${trunc(d.title, 50)}`);
    const open = deps.filter((d) => d.status !== "done");
    if (open.length) console.log(c("yellow", `    → 아직 ${open.length}개가 완료되지 않았다.`));
  }
  const dependents = bl.tasks.filter((x) => (x.deps ?? []).includes(t.id));
  if (dependents.length) {
    console.log(c("bold", "\n  이 작업을 기다리는 작업"));
    for (const d of dependents) console.log(`    ${statusCell(d)}  ${c("dim", d.id)}  ${trunc(d.title, 50)}`);
  }
  console.log("");
}

/** 선행 작업이 모두 끝난 todo만 고른다. "지금 뭐 하지"에 대한 답. */
function cmdNext(bl, { flags }) {
  const byId = new Map(bl.tasks.map((t) => [t.id, t]));
  const ready = bl.tasks.filter((t) =>
    t.status === "todo" && (t.deps ?? []).every((d) => byId.get(d)?.status === "done"));
  const prio = (p) => bl.enums.priority.indexOf(p);
  const sorted = ready.sort((a, b) => prio(a.priority) - prio(b.priority) || a.id.localeCompare(b.id));
  const limit = Number(flags.limit ?? 10);
  const shown = sorted.slice(0, limit);
  if (flags.json) { console.log(JSON.stringify(shown, null, 2)); return; }

  const running = bl.tasks.filter((t) => t.status === "in_progress");
  if (running.length) {
    console.log(c("bold", "\n지금 작업중"));
    for (const t of running) console.log(`  ${statusCell(t)}  ${c("dim", t.id)}  ${trunc(t.title, 55)}`);
  }
  console.log(c("bold", "\n바로 시작할 수 있는 작업") + c("dim", " (선행 작업이 모두 완료됨)"));
  if (!shown.length) console.log(c("dim", "  없다. blocked·needs_decision 작업을 먼저 푼다."));
  for (const t of shown) console.log(`  ${c("dim", t.priority)}  ${c("dim", t.id)}  ${pad(trunc(t.title, 45), 45)}  ${c("dim", t.phase)}`);
  if (sorted.length > limit) console.log(c("dim", `  … 외 ${sorted.length - limit}개`));

  const stuck = bl.tasks.filter((t) => t.status === "needs_decision" || t.status === "blocked");
  if (stuck.length) {
    console.log(c("bold", "\n사람이 풀어야 막히지 않는 것"));
    for (const t of stuck) console.log(`  ${statusCell(t)}  ${c("dim", t.id)}  ${trunc(t.title, 40)}  ${c("yellow", trunc(t.note ?? "", 40))}`);
  }
  console.log("");
}

function cmdStats(bl, { flags }) {
  const counts = {};
  for (const t of bl.tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  if (flags.json) {
    const perPhase = Object.fromEntries(bl.phases.map((p) => {
      const ts = bl.tasks.filter((t) => t.phase === p);
      return [p, { total: ts.length, done: ts.filter((t) => t.status === "done").length }];
    }));
    console.log(JSON.stringify({ status: counts, phases: perPhase, total: bl.tasks.length }, null, 2));
    return;
  }
  const done = counts.done ?? 0, total = bl.tasks.length;
  console.log(c("bold", `\n${bl.meta.project ?? "백로그"}`) + c("dim", `  (갱신 ${bl.meta.updated})`));
  console.log(c("bold", "\n상태"));
  for (const s of STATUS_ORDER) {
    if (!counts[s]) continue;
    console.log(`  ${pad(bl.labels?.status?.[s] ?? s, 14)} ${c(STATUS_COLOR[s], String(counts[s]).padStart(3))}`);
  }
  console.log(c("bold", "\n단계별 진행"));
  for (const p of bl.phases) {
    const ts = bl.tasks.filter((t) => t.phase === p);
    const d = ts.filter((t) => t.status === "done").length;
    const filled = ts.length ? Math.round((d / ts.length) * 20) : 0;
    const bar = c("green", "█".repeat(filled)) + c("dim", "░".repeat(20 - filled));
    console.log(`  ${pad(trunc(p, 20), 20)} ${bar} ${String(d).padStart(2)}/${String(ts.length).padStart(2)}`);
  }
  const remain = bl.tasks.filter((t) => !TERMINAL.has(t.status)).reduce((a, t) => a + t.estimate_min, 0);
  console.log(c("dim", `\n전체 ${total}개 중 ${done}개 완료 (${total ? Math.round((done / total) * 100) : 0}%) · 남은 예상 ${(remain / 60).toFixed(1)}시간\n`));
}

function cmdCheck(bl) {
  const { errors, warns } = validate(bl);
  for (const w of warns) console.log(c("yellow", "경고: ") + w);
  if (errors.length) {
    for (const e of errors) console.error(c("red", "오류: ") + e);
    console.error(`\nINVALID — 오류 ${errors.length}건, 경고 ${warns.length}건`);
    process.exit(1);
  }
  console.log(c("green", `VALID`) + ` — 작업 ${bl.tasks.length}개, 경고 ${warns.length}건`);
}

// ─────────────────────────────── 변경 명령 ───────────────────────────────

function touch(t) { t.updated_at = today(); }

function cmdSet(bl, { positional, flags }) {
  const t = resolveTask(bl, positional[0]);
  if (!positional[1]) fail(`바꿀 상태가 필요하다. 예: backlog set ${t.id} in_progress`);
  const next = resolveStatus(bl, positional[1]);
  const prev = t.status;
  if (flags.note) t.note = String(flags.note);

  if (NEEDS_NOTE.has(next) && !String(t.note ?? "").trim())
    fail(`${bl.labels?.status?.[next] ?? next} 상태는 사유가 필요하다. --note "사유"를 붙인다.`);

  t.status = next;
  if (TERMINAL.has(next)) t.done_at = flags.date ? String(flags.date) : (t.done_at ?? today());
  else t.done_at = null;
  touch(t);
  write(bl);

  const L = bl.labels?.status ?? {};
  console.log(`${c("dim", t.id)} ${t.title}`);
  console.log(`  ${c(STATUS_COLOR[prev], L[prev] ?? prev)} → ${c(STATUS_COLOR[next], L[next] ?? next)}${t.done_at ? c("dim", `  (완료일 ${t.done_at})`) : ""}`);
  if (t.note) console.log(c("yellow", `  사유: ${t.note}`));

  // 막 완료했다면, 이 작업 때문에 막혀 있던 작업을 알려 준다
  if (next === "done") {
    const byId = new Map(bl.tasks.map((x) => [x.id, x]));
    const freed = bl.tasks.filter((x) =>
      (x.deps ?? []).includes(t.id) && x.status !== "done" &&
      (x.deps ?? []).every((d) => byId.get(d)?.status === "done"));
    if (freed.length) {
      console.log(c("green", "\n  이제 시작할 수 있는 작업"));
      for (const f of freed) console.log(`    ${c("dim", f.id)}  ${trunc(f.title, 50)}`);
    }
  }
  // 선행이 안 끝났는데 진행하려는 경우 막지는 않고 알린다
  if (next === "in_progress") {
    const byId = new Map(bl.tasks.map((x) => [x.id, x]));
    const open = (t.deps ?? []).filter((d) => byId.get(d) && byId.get(d).status !== "done");
    if (open.length) console.log(c("yellow", `\n  주의: 선행 작업 ${open.join(", ")}이(가) 아직 완료되지 않았다.`));
  }
}

function cmdEdit(bl, { positional, flags }) {
  const t = resolveTask(bl, positional[0]);
  const changed = [];
  const given = Object.keys(flags).filter((k) => k !== "json");
  if (!given.length) fail(`바꿀 항목이 없다. 가능한 항목: ${EDITABLE.map((f) => "--" + f).join(" ")}`);
  const unknown = given.filter((k) => !EDITABLE.includes(k));
  if (unknown.length) fail(`알 수 없는 항목: ${unknown.join(", ")}\n  가능한 항목: ${EDITABLE.map((f) => "--" + f).join(" ")}`);

  for (const key of given) {
    const v = flags[key];
    switch (key) {
      case "title": case "summary": {
        const val = v === true ? "" : String(v);
        if (!val.trim()) fail(`--${key}는 비울 수 없다.`);
        changed.push([key, t[key], val]); t[key] = val; break;
      }
      case "where": {
        const val = v === true ? "" : String(v).trim();
        changed.push(["where", t.where, val || null]); t.where = val || null; break;
      }
      case "note": {
        const val = v === true ? "" : String(v);
        if (!val.trim() && NEEDS_NOTE.has(t.status)) fail(`${t.status} 상태에서는 사유를 비울 수 없다.`);
        changed.push(["note", t.note, val || null]); t.note = val || null; break;
      }
      case "priority": {
        const val = String(v).toUpperCase();
        const ok = bl.enums.priority.includes(val) ? val : resolveEnum(bl, "priority", val, "우선순위");
        changed.push(["priority", t.priority, ok]); t.priority = ok; break;
      }
      case "category": { const val = resolveEnum(bl, "category", v, "분류"); changed.push(["category", t.category, val]); t.category = val; break; }
      case "phase": { const val = resolvePhase(bl, v); changed.push(["phase", t.phase, val]); t.phase = val; break; }
      case "estimate": {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) fail("--estimate는 양의 정수(분)여야 한다.");
        changed.push(["estimate_min", t.estimate_min, n]); t.estimate_min = n; break;
      }
      case "deps": {
        const val = v === true ? [] : parseDeps(bl, v);
        changed.push(["deps", (t.deps ?? []).join(",") || "없음", val.join(",") || "없음"]); t.deps = val; break;
      }
      case "refs": {
        const val = v === true ? [] : String(v).split(",").map((s) => s.trim()).filter(Boolean);
        changed.push(["refs", (t.refs ?? []).join(", ") || "없음", val.join(", ") || "없음"]); t.refs = val; break;
      }
    }
  }
  touch(t);
  write(bl);
  console.log(`${c("dim", t.id)} ${t.title}`);
  for (const [k, before, after] of changed) console.log(`  ${k}: ${c("dim", before ?? "없음")} → ${c("green", after ?? "없음")}`);
}

/** 상세 문서를 생성된 96개와 같은 형식으로 만든다. */
function docTemplate(bl, t) {
  const byId = new Map(bl.tasks.map((x) => [x.id, x]));
  const deps = (t.deps ?? []).map((d) => `[${d}](${d}.md) ${byId.get(d)?.title ?? ""}`).join(", ") || "없음";
  const L = [];
  L.push(`# ${t.id} · ${t.title}`, "");
  L.push("> 작업 상태의 SSOT는 저장소 루트의 `backlog.json`이다. 이 문서는 무엇을 왜 어떻게 만드는지만 다룬다.", "");
  L.push("| 항목 | 값 |", "| --- | --- |");
  L.push(`| 단계 | ${t.phase} |`);
  L.push(`| 분류 | ${bl.labels?.category?.[t.category] ?? t.category} |`);
  L.push(`| 우선순위 | ${t.priority ?? "없음"} |`);
  L.push(`| 예상 시간 | ${t.estimate_min}분 |`);
  L.push(`| 선행 작업 | ${deps} |`);
  L.push(`| 요구사항 근거 | ${(t.refs ?? []).join(", ") || "—"} |`);
  if (t.where) L.push(`| 주요 위치 | \`${t.where}\` |`);
  L.push("", "## 목적", "", t.summary, "");
  L.push("## 작업 범위", "", "- (채울 것)", "");
  L.push("## 완료 기준", "", "- [ ] (채울 것)", "");
  L.push("## 연관 작업", "", "- 없음", "");
  return L.join("\n");
}

function writeDoc(bl, t, { force = false } = {}) {
  const abs = join(ROOT, t.doc);
  if (existsSync(abs) && !force) return false;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, docTemplate(bl, t));
  return true;
}

function cmdAdd(bl, { flags }) {
  if (!flags.title || flags.title === true) fail('--title "제목"이 필요하다.');
  if (!flags.category) fail(`--category가 필요하다. 가능한 값: ${bl.enums.category.join(", ")}`);
  if (!flags.phase) fail(`--phase가 필요하다. 가능한 값: ${bl.phases.join(" / ")}`);

  let id;
  if (flags.id && flags.id !== true) {
    id = String(flags.id).toUpperCase();
    if (/^\d+$/.test(String(flags.id))) id = "T-" + String(flags.id).padStart(3, "0");
    if (!/^T-\d{3}$/.test(id)) fail("--id 형식은 T-000이어야 한다.");
    if (bl.tasks.some((t) => t.id === id)) fail(`${id}는 이미 있다.`);
  } else {
    const max = bl.tasks.reduce((m, t) => Math.max(m, Number(t.id.slice(2))), 0);
    id = "T-" + String(max + 1).padStart(3, "0");
  }

  const phase = resolvePhase(bl, flags.phase);
  const status = flags.status ? resolveStatus(bl, flags.status) : "todo";
  const note = flags.note && flags.note !== true ? String(flags.note) : null;
  if (NEEDS_NOTE.has(status) && !note) fail(`${bl.labels?.status?.[status] ?? status} 상태로 만들려면 --note "사유"가 필요하다.`);

  const t = {
    id,
    title: String(flags.title),
    summary: flags.summary && flags.summary !== true ? String(flags.summary) : String(flags.title),
    doc: docPath(bl, id),
    status,
    priority: flags.priority ? String(flags.priority).toUpperCase() : "P2",
    category: resolveEnum(bl, "category", flags.category, "분류"),
    phase,
    estimate_min: flags.estimate ? Number(flags.estimate) : (bl.meta.task_unit_min ?? 30),
    deps: flags.deps && flags.deps !== true ? parseDeps(bl, flags.deps) : [],
    where: flags.where && flags.where !== true ? String(flags.where) : null,
    refs: flags.refs && flags.refs !== true ? String(flags.refs).split(",").map((s) => s.trim()).filter(Boolean) : [],
    note,
    done_at: TERMINAL.has(status) ? today() : null,
    updated_at: today(),
  };

  // 같은 단계의 마지막 뒤에 넣어 JSON이 단계별로 묶인 상태를 유지한다
  let at = -1;
  for (let i = 0; i < bl.tasks.length; i++) if (bl.tasks[i].phase === phase) at = i;
  if (at >= 0) bl.tasks.splice(at + 1, 0, t); else bl.tasks.push(t);

  const created = flags["no-doc"] ? false : writeDoc(bl, t);
  write(bl);
  console.log(c("green", "추가됨 ") + c("bold", `${t.id}  ${t.title}`));
  console.log(`  ${t.phase} · ${bl.labels?.category?.[t.category] ?? t.category} · ${t.priority} · ${t.estimate_min}분`);
  if (t.deps.length) console.log(`  선행 작업: ${t.deps.join(", ")}`);
  console.log(`  문서: ${t.doc}${created ? c("green", " (새로 만듦)") : c("dim", " (이미 있음)")}`);
}

function cmdDoc(bl, { positional, flags }) {
  const t = resolveTask(bl, positional[0]);
  const abs = join(ROOT, t.doc);
  if (flags.create || flags.force) {
    const created = writeDoc(bl, t, { force: !!flags.force });
    console.log(created ? c("green", "만듦 ") + t.doc : c("dim", "이미 있다 ") + t.doc + " (덮어쓰려면 --force)");
    return;
  }
  if (!existsSync(abs)) { console.log(c("red", "없다 ") + t.doc + c("dim", "  (--create로 만든다)")); process.exit(1); }
  if (flags.path) { console.log(abs); return; }
  console.log(readFileSync(abs, "utf8"));
}

// ─────────────────────────────── 진입점 ───────────────────────────────

const HELP = `
${c("bold", "backlog")} — 이불공장 납품·정산 관리 사이트 백로그 CLI
대상 파일: ${relative(process.cwd(), FILE) || FILE}

${c("bold", "조회")}
  backlog                             미완료 작업 전체 (기본)
  backlog list [옵션]                 --status/--priority/--category/--phase/--search
                                      --all 전체 · --done 완료만 · --json
  backlog get <id>                    한 작업 상세 (선행·후행 작업 포함)
  backlog next [--limit N]            지금 바로 시작할 수 있는 작업
  backlog stats                       단계별 진행률과 남은 시간
  backlog check                       무결성 검증 (오류 있으면 종료 코드 1)
  backlog doc <id> [--create|--path]  상세 문서 보기·만들기

${c("bold", "변경")}
  backlog set <id> <상태> [--note "사유"]
      상태: ${Object.entries(SHORT).map(([k, v]) => `${k}(${v})`).join(" ")}
      대기·판단·취소로 바꿀 때는 --note가 필요하다.
  backlog edit <id> --title "..." --priority P1 --deps "1,2" --where "app/..." ...
      바꿀 수 있는 항목: ${EDITABLE.map((f) => "--" + f).join(" ")}
  backlog add --title "제목" --category feature --phase "2. 송장" [--summary ... --priority P1 --deps "9,10"]
      id는 자동으로 붙고 docs/tasks/<id>.md도 함께 만들어진다.

${c("bold", "쓰기 규칙")}
  모든 변경은 저장 직전에 검증한다. 검증에 실패하면 파일을 건드리지 않는다.
  id는 56, t-056, T-056, 제목 일부 모두 받는다. 상태·단계도 한글/약칭으로 받는다.

${c("bold", "예")}
  backlog next
  backlog set 2 진행
  backlog set 2 done
  backlog set 19 대기 --note "T-001 공장 정보 확정 대기"
  backlog list --phase 송장 --status todo
  backlog add --title "인쇄 여백 조정" --category ui --phase "2. 송장" --deps 45
`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h") || argv[0] === "help") { console.log(HELP); return; }
  const { positional, flags } = parseArgs(argv);
  let cmd = positional[0] && !positional[0].startsWith("-") ? positional[0] : "list";
  let rest = { positional: positional.slice(cmd === positional[0] ? 1 : 0), flags };
  // `backlog 56`, `backlog T-056` 처럼 id만 준 경우는 get으로 본다
  if (/^(T-)?\d{1,3}$/i.test(cmd)) { rest = { positional: [cmd, ...rest.positional], flags }; cmd = "get"; }
  const bl = read();
  switch (cmd) {
    case "list": case "ls": return cmdList(bl, rest);
    case "get": case "show": return cmdGet(bl, rest);
    case "next": return cmdNext(bl, rest);
    case "stats": case "status": return cmdStats(bl, rest);
    case "check": case "validate": return cmdCheck(bl);
    case "set": return cmdSet(bl, rest);
    case "edit": case "update": return cmdEdit(bl, rest);
    case "add": case "new": return cmdAdd(bl, rest);
    case "doc": return cmdDoc(bl, rest);
    default:
      fail(`알 수 없는 명령 '${cmd}'. backlog --help 로 사용법을 본다.`);
  }
}

main();
