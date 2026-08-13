# Changelog

## [0.2.0] - 2026-08-13

### Added

- ZCode lifecycle hooks for `SessionStart`, `UserPromptSubmit`, and `Stop`.
- Startup Context Bundle injection and conservative prompt-time memory recall through hook `additionalContext`.
- Stop-hook transcript capture through `nmem t sync --from zcode --session-dir <transcript_path> --all-projects --apply`.
- ZCode commands for status checks, manual hook transcript sync, and explicit handoff saves.
- Static validation for commands and hooks.

### Changed

- The package is now a native `plugin + MCP + Skills + commands + hooks` connector.
- Documentation now treats hook-based transcript capture as the primary path while still requiring users to verify that their ZCode build fires `Stop` hooks.

## [0.1.0] - 2026-08-08

### Added

- Initial ZCode Plugin package with official `.zcode-plugin/plugin.json` metadata.
- Bundled Nowledge Mem HTTP MCP configuration with a credential-free local default.
- Skills for Context Bundle / Working Memory, proactive search, distillation, status, integration checks, and honest handoff summaries.
- Documentation of local and remote setup, reload behavior, user-owned overrides, and the handoff-only thread boundary.

### Not included

- Automatic session-memory synchronization, automatic recall injection, automatic transcript capture, pre-compaction capture, and full `save-thread` import remain unavailable until ZCode exposes a verified primary-session lifecycle and transcript export contract.
