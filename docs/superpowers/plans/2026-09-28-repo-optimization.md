# Repository Optimization Implementation Plan

> **For agentic workers:** Implement inline in this task. Keep each workstream independently reviewable and verify it before moving on.

**Goal:** Reduce extension startup cost, make oversized tool code easier to maintain, keep documentation accurate, and prevent generated artifacts from accumulating locally while preserving current behavior.

**Architecture:** Work in five bounded workstreams: build cleanup, extension startup/resource loading, tool-module decomposition, architecture documentation, and CI integration coverage. Keep browser tool APIs and returned MCP schemas stable; change packaging only when source references and built output prove an asset can be omitted or deferred.

**Tech Stack:** pnpm workspace, TypeScript, WXT/Vite, Node.js built-in test runner, GitHub Actions, Chrome extension MV3.

**Spec:** Prior user-approved improvement list in the conversation (five items: large modules, semantic assets, architecture documentation, end-to-end verification, generated artifact cleanup).

## Global Constraints

- Preserve current extension tool names, schemas, and behavior.
- Do not remove ONNX Runtime WASM files unless production build/runtime evidence proves they are unused.
- Do not add runtime dependencies for cleanup or verification.
- Tests are explicitly in scope because end-to-end verification was one of the approved improvements.
- Do not commit changes unless the user asks.

---

### Task 1: Clean generated artifacts and test the cleaner

**Files:**

- Modify: `scripts/clean.mjs`
- Create: `scripts/clean.test.mjs`
- Modify: `package.json`

**Interfaces:**

- `node scripts/clean.mjs --dist` removes generated `dist`, `.output`, `.turbo`, and `.windows-stage` directories at workspace roots.
- `node scripts/clean.mjs --modules` keeps its current node_modules behavior.

- [x] Add node:test coverage using a temporary workspace tree for both modes and an invalid mode.
- [x] Run `node --test scripts/clean.test.mjs` and confirm the new tests fail against current behavior.
- [x] Extend only the existing target list and add a root `test:clean-script` command.
- [x] Re-run the focused tests and confirm all pass.

### Task 2: Defer semantic engine startup work

**Files:**

- Modify: `app/chrome-extension/entrypoints/background/index.ts`
- Modify: `app/chrome-extension/entrypoints/background/semantic-similarity.ts`
- Modify: `app/chrome-extension/entrypoints/popup/App.vue` only if the built chunk report shows the engine is eagerly included there.

**Interfaces:**

- Keep existing semantic message types and popup behavior unchanged.
- Load engine/cache modules only when a semantic operation or cached model requires them.

- [x] Capture a production baseline build and identify semantic engine/ORT code in background and popup entry chunks.
- [x] Add a focused startup contract test or build assertion for deferred engine loading.
- [x] Convert background semantic listener and cache startup imports to dynamic imports at actual use sites.
- [x] Rebuild and compare entry chunks; confirm non-semantic startup no longer evaluates the semantic engine.
- [x] Exercise extension typecheck and semantic-related tests.

Implementation note: the popup chunk is about 121 KB and contains no `AutoTokenizer` code. Semantic background modules are deferred at runtime. WXT still emits one roughly 2.76 MB background bundle, so this change does not reduce background bundle size.

### Task 3: Split high-churn browser tool modules by responsibility

Implementation note: computer execution now lives in `computer-actions.ts` behind an abstract base, the CDP input adapter is in `cdp-input.ts`, and fixed-FPS recording/session state is in `gif-recording-session.ts`. Existing tool names and schemas remain in the original registration modules.

Implementation note: computer execution now lives in `computer-actions.ts` behind an abstract base, the CDP input adapter is in `cdp-input.ts`, and fixed-FPS recording/session state is in `gif-recording-session.ts`. Existing tool names and schemas remain in the original registration modules.

**Files:**

- Refactor: `app/chrome-extension/entrypoints/background/tools/browser/scroll.ts`
- Refactor: `app/chrome-extension/entrypoints/background/tools/browser/collector-tools.ts`
- Refactor: `app/chrome-extension/entrypoints/background/tools/browser/computer.ts`
- Refactor: `app/chrome-extension/entrypoints/background/tools/browser/gif-recorder.ts`
- Tests: existing `tests/tools/computer.test.ts`, `tests/tools/collector-utils.test.ts`, plus focused tests beside newly extracted pure helpers.

**Interfaces:**

- Keep exported tool registrations and MCP-facing behavior stable.
- New modules expose only focused expression builders, shared collector helpers, or recording helpers actually consumed by the original tool.

- [x] Map each file's responsibilities and public registrations before moving code.
- [x] Add or extend characterization tests for extracted pure behavior and run them to observe expected failures.
- [x] Move code without behavior changes, keeping dependencies local to each responsibility.
- [x] Run focused tests, extension typecheck, and extension lint after each file split.
- [x] Confirm original large files shrink materially and registrations/tool schemas remain unchanged.

### Task 4: Bring architecture docs in line with the current repository

Implementation note: removed the unused `public/wxt.svg` (326 KB); a clean production build confirms it is absent from generated output.

Implementation note: removed the unused `public/wxt.svg` (326 KB); a clean production build confirms it is absent from generated output.

**Files:**

- Rewrite: `docs/ARCHITECTURE.md`
- Update: `docs/ARCHITECTURE_zh.md`
- Inspect: `app/native-server/src/server/index.ts`, `app/native-server/src/mcp/`, extension background/offscreen entrypoints, and desktop Tauri files.

- [x] Derive diagrams from current source entrypoints and real message/transport paths.
- [x] Remove unsupported architecture/performance claims and stale implementation instructions.
- [x] Ensure English and Chinese documents describe the same components and flow.
- [x] Run Markdown formatting and compare the two documents section by section.

### Task 5: Add a repeatable CI integration gate

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify or create: `scripts/chrome-smoke.mjs` and its automated test harness.

**Interfaces:**

- Preserve the existing manual smoke test against a user-prepared Chrome + native host environment.
- Add a deterministic CI test that validates the complete MCP initialize → tools/list → tools/call protocol flow against an isolated test endpoint, without requiring a logged-in user's Chrome profile.

- [x] Extract protocol assertions so they can run against a local test server using Node's built-in test runner.
- [x] Run the new test first and confirm the current smoke implementation does not satisfy it.
- [x] Add an ephemeral server fixture and assert status/probe, session initialization, tool discovery, and tool call error handling.
- [x] Wire the deterministic test into CI; retain the self-hosted browser smoke as the real-browser acceptance check.
- [x] Run the focused smoke tests and relevant native-server tests.

## Final Verification

Verification outcome: extension 72 suites / 636 tests passed; native server 19 suites / 85 tests passed; full workspace lint and typecheck passed; tool documentation check passed for 81 schemas; cleanup tests passed 3/3; production build passed.

Verification outcome: extension 72 suites / 636 tests passed; native server 19 suites / 85 tests passed; full workspace lint and typecheck passed; tool documentation check passed for 81 schemas; cleanup tests passed 3/3; production build passed.

- [x] Run `pnpm test:clean-script`.
- [x] Run `pnpm --filter @ethanwilkins/chrome-mcp-server-2026 typecheck` and its relevant tests.
- [x] Run `pnpm --filter @ethanwilkins/mcp-chrome-bridge-2026 test`.
- [x] Run `pnpm check:tool-docs`, `pnpm lint`, and `pnpm build`.
- [x] Inspect the final diff and confirm tool schemas, names, and behavior did not change unintentionally.
