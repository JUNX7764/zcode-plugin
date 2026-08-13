---
name: check-integration
description: Check Nowledge Mem setup in ZCode, explain what the plugin provides, and guide local or remote MCP configuration when memory tools are unavailable.
---

# Check ZCode Integration

Use this when Nowledge Mem setup is new, a memory tool is missing, or the user asks whether the integration is working.

## Step 1: Verify the client

Run:

```bash
nmem --json status
```

If the command is missing, use the Nowledge Mem desktop app's bundled CLI installation, or install the standalone `nmem-cli` on a separate client machine. Do not replace a desktop-managed CLI with a standalone install unless the user asks for that.

If status fails:

- local machine: open Nowledge Mem Desktop and retry;
- remote machine: verify the URL and API key in the user's own client configuration;
- ZCode: check **Settings → MCP → Plugin MCP servers**, then reload/restart the Agent runtime.

Never put an API key in a command argument, plugin file, or log.

## Step 2: Install for ZCode

In ZCode, open **Settings → Plugins → Create → Add marketplace**, add:

```text
https://github.com/nowledge-co/zcode-plugin
```

Install and enable `nowledge-mem-zcode`, then reload the Agent runtime. After a standalone repository update, use **Marketplace sources → Refresh this marketplace**, then **Manage installed → Check for updates** for `nowledge-mem-zcode`, and reload if components do not appear immediately.

## Expected behavior

This ZCode package provides:

- **Working Memory and Context Bundle:** guided through Skills and MCP;
- **Startup context:** `SessionStart` hook injection when the local `nmem` CLI is reachable;
- **Recall:** guided proactive searches across memories and threads, plus conservative `UserPromptSubmit` hook recall for prompts that clearly need history;
- **Distillation:** guided durable saves using search-before-update/add;
- **Status:** CLI/MCP diagnostics;
- **Threads:** `Stop` hook transcript capture through `nmem t sync --from zcode`, plus explicit structured handoff summaries as fallback.

ZCode exposes hook transcripts as temporary JSONL files. This plugin copies the `transcript_path` during the `Stop` hook before asking `nmem` to import it. If a user's ZCode build does not fire `Stop`, use `nowledge-mem-sync-now` when a hook context exposes `transcript_path`, or save a handoff summary. Do not claim a transcript was imported unless `nmem t sync --from zcode` succeeded.

## Local installation

For local testing, add the repository's ZCode marketplace or plugin directory from **Settings → Plugins → Create → Add marketplace**, install the ZCode package, enable it, and reload the Agent runtime. After package changes, refresh the marketplace source and use **Manage installed → Check for updates**.

## Remote Mem

Do not edit installed plugin files. Configure the user's own ZCode MCP settings with:

```bash
nmem config mcp show --host zcode
```

Paste the generated host-owned MCP block into ZCode and reload the Agent runtime. This is the supported path for Cloud, Access Anywhere, self-hosted, or any endpoint requiring authentication.
