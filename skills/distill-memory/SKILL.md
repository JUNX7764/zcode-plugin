---
name: distill-memory
description: Save durable Nowledge Mem facts, preferences, decisions, plans, procedures, learnings, events, and important context when a ZCode conversation produces something worth remembering; do not wait to be asked.
---

# Distill Memory

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked, but never save secrets or sensitive personal information merely because it appears durable.

## Good candidates

- Decisions with their rationale
- Repeatable procedures and non-obvious workarounds
- Lessons from debugging, incidents, or root-cause analysis
- Durable preferences or constraints
- Plans needed to resume work later
- Important context that would otherwise be lost

Never save API keys, passwords, access tokens, private keys, or unredacted personal or customer data. Redact sensitive portions before saving. If the content may contain sensitive data and safe redaction cannot be confirmed, ask the user before saving; even after confirmation, save only the minimum necessary, sanitized durable fact.

Skip routine fixes, unstable work in progress, generic facts, simple documentation answers, and content whose sensitive parts cannot be safely removed.

## Workflow

1. Search first with MCP `memory_search` to avoid duplicates for every supported unit type: `fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, and `event`.
2. If an equivalent memory already exists, refine or merge it with `memory_update` rather than creating a duplicate, regardless of its unit type.
3. Otherwise use `memory_add` with an atomic title and standalone content.
4. Use the matching `unit_type` (`fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, or `event`) and meaningful labels/importance when known.
5. At the end of a substantial task, explicitly review whether one durable memory should be added or updated.

Keep the new memory focused on what was learned or decided, not routine activity. If an ambient space is real and known, write to that space; otherwise keep the default lane.

## CLI fallback

If MCP is unavailable, use the active ambient space when one is known:

```bash
nmem --json m search "<concept>" --space "<space name>"
nmem --json m add "<content>" -t "<title>" --unit-type "<unit_type>" --space "<space name>"
```

Replace `<unit_type>` with the validated type for this memory. Add `--label "<label>"` only when a label is known, and add `--importance <value>` only when importance is known. If no real ambient space is configured, omit `--space` and use the default lane.

Use `nmem --json m update <memory_id> --content "<updated content>" --space "<space name>"` when an existing memory should evolve in a known ambient space; omit `--space` for the default lane. This documented CLI command is the fallback for MCP `memory_update` when MCP is unavailable.
