#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const MAX_CONTEXT_CHARS = 6000;
const RECALL_PROMPT_RE =
  /\b(previous|prior|history|remember|decision|like before|regression|release|plugin|connector|sync|hook|thread|memory|context)\b/i;

function readStdin() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  return new Promise((resolve) => {
    process.stdin.on("end", () => resolve(raw));
  });
}

function runNmem(args, options = {}) {
  return spawnSync("nmem", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: options.timeoutMs ?? 12000,
    env: {
      ...process.env,
      APP: "ZCode",
      NMEM_SOURCE_APP: "zcode",
    },
  });
}

function textOf(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    for (const key of ["text", "content", "message", "value"]) {
      const text = textOf(value[key]);
      if (text) return text;
    }
  }
  return "";
}

function writeAdditionalContext(eventName, additionalContext) {
  const trimmed = String(additionalContext || "").trim().slice(0, MAX_CONTEXT_CHARS);
  if (!trimmed) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: trimmed,
    },
  }));
}

function summarizeContextBundle(payload) {
  if (!payload || typeof payload !== "object") return "";
  const rendered = payload.markdown || payload.content || payload.context || payload.working_memory;
  if (typeof rendered === "string" && rendered.trim()) return rendered.trim();
  return JSON.stringify(payload, null, 2);
}

function sessionStart(input) {
  const args = ["--json", "context", "--source-app", "zcode"];
  const result = runNmem(args, { timeoutMs: 10000 });
  if (result.status !== 0 || !result.stdout.trim()) return;
  try {
    const payload = JSON.parse(result.stdout);
    const context = summarizeContextBundle(payload);
    writeAdditionalContext("SessionStart", context);
  } catch {
    // Hook diagnostics belong on stderr; stdout must remain protocol JSON.
    process.stderr.write("[nowledge-mem-zcode] context output was not JSON\n");
  }
}

function promptRecall(input) {
  const prompt = String(input.prompt || "").trim();
  if (!prompt || !RECALL_PROMPT_RE.test(prompt)) return;
  const result = runNmem(["--json", "m", "search", prompt, "-n", "5"], { timeoutMs: 10000 });
  if (result.status !== 0 || !result.stdout.trim()) return;
  try {
    const payload = JSON.parse(result.stdout);
    const memories = Array.isArray(payload.memories) ? payload.memories.slice(0, 5) : [];
    if (!memories.length) return;
    const lines = memories.map((memory, index) => {
      const title = memory.title || `Memory ${index + 1}`;
      const content = memory.content || memory.snippet || "";
      return `- ${title}: ${String(content).replace(/\s+/g, " ").slice(0, 450)}`;
    });
    writeAdditionalContext(
      "UserPromptSubmit",
      `Relevant Nowledge Mem context for this request:\n${lines.join("\n")}`,
    );
  } catch {
    process.stderr.write("[nowledge-mem-zcode] memory search output was not JSON\n");
  }
}

function copiedTranscriptPath(input) {
  const transcript = String(input.transcript_path || input.transcriptPath || "").trim();
  if (!transcript) return null;
  let body = "";
  try {
    body = readFileSync(transcript, "utf8");
  } catch (error) {
    process.stderr.write(`[nowledge-mem-zcode] cannot read transcript_path: ${error.message}\n`);
    return null;
  }

  const sessionId = String(input.session_id || input.sessionId || "zcode-session").trim();
  const lastAssistant = textOf(input.last_assistant_message || input.lastAssistantMessage).trim();
  if (lastAssistant && !body.includes(lastAssistant.slice(0, Math.min(lastAssistant.length, 120)))) {
    body += `${body.endsWith("\n") || body.length === 0 ? "" : "\n"}${JSON.stringify({
      role: "assistant",
      session_id: sessionId,
      cwd: input.cwd,
      content: lastAssistant,
    })}\n`;
  }

  const base = process.env.ZCODE_PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || mkdtempSync(join(tmpdir(), "nmem-zcode-"));
  const dir = join(base, "transcripts");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${sessionId.replace(/[^a-zA-Z0-9._-]/g, "_")}.jsonl`);
  writeFileSync(out, body, "utf8");
  return out;
}

function stopCapture(input) {
  const transcript = copiedTranscriptPath(input);
  if (!transcript) return;
  const sessionId = String(input.session_id || input.sessionId || "").trim();
  const args = [
    "--json",
    "t",
    "sync",
    "--from",
    "zcode",
    "--session-dir",
    transcript,
    "--all-projects",
    "--apply",
  ];
  if (sessionId) args.push("--session-id", sessionId);
  const result = runNmem(args, { timeoutMs: 18000 });
  if (result.status !== 0) {
    process.stderr.write(`[nowledge-mem-zcode] thread sync failed: ${result.stderr || result.stdout}\n`);
  }
}

const raw = await readStdin();
let input = {};
try {
  input = raw.trim() ? JSON.parse(raw) : {};
} catch {
  process.stderr.write("[nowledge-mem-zcode] hook input was not JSON\n");
}

const eventName = String(input.hook_event_name || input.hookEventName || "");
try {
  if (eventName === "SessionStart") {
    sessionStart(input);
  } else if (eventName === "UserPromptSubmit") {
    promptRecall(input);
  } else if (eventName === "Stop") {
    stopCapture(input);
  }
} catch (error) {
  process.stderr.write(`[nowledge-mem-zcode] hook failed: ${error instanceof Error ? error.message : String(error)}\n`);
}
