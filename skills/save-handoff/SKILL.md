---
name: save-handoff
description: Save a concise, structured Nowledge Mem handoff when the ZCode user explicitly requests a checkpoint, resumable summary, or place to continue later.
---

# Save Handoff

Use this when the user explicitly asks for a handoff, checkpoint, summary to resume later, or to remember where the work stands. It is also the fallback when a ZCode hook context does not expose a readable `transcript_path` or the `Stop` hook did not fire.

This Skill creates a structured summary. It is **not** a full transcript import. The plugin's hook path can import a hook transcript with `nmem t sync --from zcode`, but a handoff only preserves the summary you write.

## Handoff format

Include:

- **Goal**
- **Decisions**
- **Files**
- **Risks**
- **Next**

Prefer MCP thread creation when available. Otherwise use:

```bash
nmem --json t create \
  -t "Session Handoff - <topic>" \
  -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." \
  --source zcode \
  --space "<space name>"
```

If no real ambient space is configured, omit `--space` and use the default lane.

After success, report that a handoff was saved, include its title and thread ID when available, and state that it is a summary rather than a transcript import. If saving fails, report the error and do not imply that a checkpoint exists.
