# Agent Action Snapshot Implementation Plan

**Goal:** Add a structured browser action snapshot, opt-in stale observation guards for click/fill, bounded autocomplete readiness waits, and a reproducible offline baseline.

**Architecture:** Register a new MCP tool that asks the existing accessibility helper for a structured snapshot in each reachable frame. The helper stores short-lived per-frame guards under one background-generated snapshot ID. Click and fill helpers validate those guards immediately before mutation; unscoped legacy calls stay unchanged.

**Tech Stack:** TypeScript, Chrome extension content scripts, MCP tool schemas, Vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-09-28-agent-action-snapshot-design.md`

## Global Constraints

- Preserve existing tool behavior when `snapshotId` is omitted.
- Keep target validation in the page frame immediately before mutation.
- Exclude password and file inputs from the snapshot.
- Cap snapshot storage at five entries per frame and age entries out after 30 seconds.
- Bound snapshot output to 150 controls and 24,000 UTF-8 bytes.
- Bound snapshot-scoped combobox waits to 200 ms.

---

### Task 1: Snapshot schema and page helper

**Files:**

- Modify `packages/shared/src/tools.ts` and `packages/shared/src/tools-en.ts`.
- Modify `app/chrome-extension/inject-scripts/accessibility-tree-helper.js`.
- Add focused extension helper tests.

**Interfaces:**

- `chrome_get_action_snapshot` accepts optional `tabId` and `windowId`.
- Page message `generateActionSnapshot` accepts `snapshotId` and returns page text, viewport, controls, and per-control guard metadata.

- [x] Add tests for the structured snapshot, supported operations, sensitive-field exclusion, limits, and ref reuse.
- [x] Run the focused test and confirm the expected missing-action failure.
- [x] Implement the page snapshot path using existing role/name/ref helpers.
- [x] Re-run focused tests and confirm the snapshot contract.

### Task 2: MCP execution and optional stale guards

**Files:**

- Add `app/chrome-extension/entrypoints/background/tools/browser/action-snapshot.ts`.
- Modify `app/chrome-extension/entrypoints/background/tools/index.ts` and `app/native-server/src/mcp/register-tools.ts` only where required by existing dispatch patterns.
- Modify `app/chrome-extension/entrypoints/background/tools/browser/interaction.ts`.
- Modify `click-helper.js` and `fill-helper.js`.

**Interfaces:**

- New MCP schema name: `chrome_get_action_snapshot`.
- `chrome_click_element` and `chrome_fill_or_select` accept optional `snapshotId` alongside the existing `frameId` and `ref` inputs.

- [x] Add failing tests for valid guards, unknown/expired snapshots, replaced nodes, changed local context, and legacy calls without tokens.
- [x] Run the focused test and confirm failures are caused by missing guard behavior.
- [x] Implement shared ID generation, per-frame retrieval, capped output, and per-frame five-entry/30-second guard storage.
- [x] Forward `snapshotId` through click/fill execution and reject stale targets before mutation.
- [x] Re-run focused tests and verify legacy calls remain unaffected.

### Task 3: Combobox readiness, docs, and baseline

**Files:**

- Modify `app/chrome-extension/inject-scripts/fill-helper.js`.
- Add an offline action snapshot benchmark/fixture under `app/chrome-extension/tests` or `scripts` following the repository's existing test conventions.
- Update `docs/TOOLS.md` and `docs/TOOLS_zh.md`.

- [x] Add failing tests for visible controlled options arriving and for the 200 ms no-option timeout.
- [x] Run focused tests and confirm the readiness behavior is missing.
- [x] Implement MutationObserver waiting only for snapshot-scoped combobox fills.
- [x] Add a repeatable baseline that reports legacy versus snapshot call counts and elapsed time and checks final DOM state independently.
- [x] Run the focused extension tests, tool-doc consistency check, extension typecheck, and baseline command.
- [x] Review the diff for schema parity, privacy, bounded waits, and unchanged legacy behavior.
