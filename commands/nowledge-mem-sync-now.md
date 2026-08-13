---
description: Capture the current ZCode hook transcript when the lifecycle hook exposed one.
---

Synchronize the current ZCode conversation into Nowledge Mem only when a ZCode hook has provided a `transcript_path`.

If a transcript path is available, run:

```bash
nmem t sync --from zcode --session-dir <transcript_path> --session-id <session_id> --all-projects --apply
```

If no transcript path is available in this command context, save a handoff summary instead. Do not claim the full conversation was imported unless the `nmem t sync --from zcode` command succeeded.
