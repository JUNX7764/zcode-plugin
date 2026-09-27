#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const pluginRoot = fileURLToPath(new URL("..", import.meta.url));
const hook = join(pluginRoot, "hooks", "zcode-mem-hook.mjs");
const root = mkdtempSync(join(tmpdir(), "nmem-zcode-hook-test-"));
const bin = join(root, "bin");
const pluginData = join(root, "plugin-data");
const captured = join(root, "captured.jsonl");

mkdirSync(bin, { recursive: true });
writeFileSync(
  join(bin, "nmem"),
  `#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--session-dir" ]; then
    cp "$2" "$NMEM_CAPTURE_PATH"
    break
  fi
  shift
done
`,
  { mode: 0o700 },
);
chmodSync(join(bin, "nmem"), 0o700);

function runHook(input) {
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ZCODE_PLUGIN_DATA: pluginData,
      NMEM_CAPTURE_PATH: captured,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function events(path) {
  return readFileSync(path, "utf8").trim().split("\n").map((line) => JSON.parse(line));
}

const compact = join(root, "compact.jsonl");
writeFileSync(
  compact,
  `${JSON.stringify({ type: "assistant", sessionId: "compact-session", content: "first reply" })}\n${JSON.stringify({ type: "assistant", sessionId: "compact-session", content: "second reply" })}\n`,
);

runHook({
  hook_event_name: "UserPromptSubmit",
  session_id: "compact-session",
  cwd: "/workspace/project",
  timestamp: "2026-09-03T00:00:01Z",
  prompt: "first prompt",
});
runHook({
  hook_event_name: "UserPromptSubmit",
  session_id: "compact-session",
  cwd: "/workspace/project",
  timestamp: "2026-09-03T00:00:02Z",
  prompt: "second prompt",
});
runHook({
  hook_event_name: "Stop",
  session_id: "compact-session",
  cwd: "/workspace/project",
  transcript_path: compact,
  last_assistant_message: "second reply",
});

assert.deepEqual(
  events(captured).map((event) => [event.role || event.type, event.content]),
  [
    ["user", "first prompt"],
    ["assistant", "first reply"],
    ["user", "second prompt"],
    ["assistant", "second reply"],
  ],
);
assert.equal(existsSync(join(pluginData, "pending-prompts", "compact-session.jsonl")), false);

const complete = join(root, "complete.jsonl");
writeFileSync(
  complete,
  `${JSON.stringify({ role: "user", content: "legacy prompt" })}\n${JSON.stringify({ role: "assistant", content: "legacy reply" })}\n`,
);
runHook({
  hook_event_name: "UserPromptSubmit",
  session_id: "complete-session",
  prompt: "duplicate hook prompt",
});
runHook({
  hook_event_name: "Stop",
  session_id: "complete-session",
  transcript_path: complete,
});
assert.deepEqual(
  events(captured).map((event) => [event.role, event.content]),
  [
    ["user", "legacy prompt"],
    ["assistant", "legacy reply"],
  ],
);

const mismatched = join(root, "mismatched.jsonl");
writeFileSync(mismatched, `${JSON.stringify({ role: "assistant", content: "only reply" })}\n`);
runHook({
  hook_event_name: "UserPromptSubmit",
  session_id: "mismatched-session",
  prompt: "first prompt",
});
runHook({
  hook_event_name: "UserPromptSubmit",
  session_id: "mismatched-session",
  prompt: "second prompt",
});
const mismatch = runHook({
  hook_event_name: "Stop",
  session_id: "mismatched-session",
  transcript_path: mismatched,
});
// Issue #5: the newest prompt still pairs with the newest capturable reply;
// older prompts whose replies were compacted away are dropped with a
// diagnostic instead of stalling the session's sync forever.
assert.match(mismatch.stderr, /pairing latest 1 prompt/);
assert.deepEqual(
  events(captured).map((event) => [event.role || event.type, event.content]),
  [
    ["user", "second prompt"],
    ["assistant", "only reply"],
  ],
);
assert.equal(existsSync(join(pluginData, "pending-prompts", "mismatched-session.jsonl")), false);

const cumulativeFirst = join(root, "cumulative-first.jsonl");
writeFileSync(
  cumulativeFirst,
  `${JSON.stringify({ type: "assistant", sessionId: "turn-session", content: "turn one reply" })}\n`,
);
runHook({
  hook_event_name: "UserPromptSubmit",
  session_id: "turn-session",
  cwd: "/workspace/project",
  timestamp: "2026-09-03T00:00:03Z",
  prompt: "turn one prompt",
});
runHook({
  hook_event_name: "Stop",
  session_id: "turn-session",
  cwd: "/workspace/project",
  transcript_path: cumulativeFirst,
  last_assistant_message: "turn one reply",
});
assert.deepEqual(
  events(captured).map((event) => [event.role || event.type, event.content]),
  [
    ["user", "turn one prompt"],
    ["assistant", "turn one reply"],
  ],
);
assert.equal(existsSync(join(pluginData, "pending-prompts", "turn-session.jsonl")), false);

const cumulativeSecond = join(root, "cumulative-second.jsonl");
writeFileSync(
  cumulativeSecond,
  `${JSON.stringify({ type: "assistant", sessionId: "turn-session", content: "turn one reply" })}\n${JSON.stringify({ type: "assistant", sessionId: "turn-session", content: "turn two reply" })}\n`,
);
runHook({
  hook_event_name: "UserPromptSubmit",
  session_id: "turn-session",
  cwd: "/workspace/project",
  timestamp: "2026-09-03T00:00:04Z",
  prompt: "turn two prompt",
});
runHook({
  hook_event_name: "Stop",
  session_id: "turn-session",
  cwd: "/workspace/project",
  transcript_path: cumulativeSecond,
  last_assistant_message: "turn two reply",
});
assert.deepEqual(
  events(captured).map((event) => [event.role || event.type, event.content]),
  [
    // Issue #5: ZCode's Stop transcript only carries the latest turn, so the
    // per-session transcript must accumulate for nmem's positional
    // reconciliation to append the new messages.
    ["user", "turn one prompt"],
    ["assistant", "turn one reply"],
    ["user", "turn two prompt"],
    ["assistant", "turn two reply"],
  ],
);
assert.equal(existsSync(join(pluginData, "pending-prompts", "turn-session.jsonl")), false);

// A retried Stop (e.g. the first sync failed before nmem acknowledged it)
// re-asserts the latest turn; the accumulated transcript keeps one copy of
// each message instead of duplicating the retried pair.
runHook({
  hook_event_name: "UserPromptSubmit",
  session_id: "turn-session",
  cwd: "/workspace/project",
  timestamp: "2026-09-03T00:00:04Z",
  prompt: "turn two prompt",
});
runHook({
  hook_event_name: "Stop",
  session_id: "turn-session",
  cwd: "/workspace/project",
  transcript_path: cumulativeSecond,
  last_assistant_message: "turn two reply",
});
assert.deepEqual(
  events(captured).map((event) => [event.role || event.type, event.content]),
  [
    ["user", "turn one prompt"],
    ["assistant", "turn one reply"],
    ["user", "turn two prompt"],
    ["assistant", "turn two reply"],
  ],
);
assert.equal(existsSync(join(pluginData, "pending-prompts", "turn-session.jsonl")), false);

console.log("ZCode hook transcript tests passed");
