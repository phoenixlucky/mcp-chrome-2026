# Element Marker Expansion Implementation Plan

> **For agentic workers:** Execute the tasks in order in this working tree. Preserve pre-existing changes. Do not add or run automated tests unless the user requests them. Use the focused static checks and production build in the final task.

**Goal:** Implement all eight approved element-marker capabilities while keeping legacy markers and workflows functional.

**Architecture:** Extend the IndexedDB marker record with optional group, tag, and per-member frame-aware locator fields. Keep the content-script overlay responsible for selection, preview, and extraction; use background messages for persistence and validation. Workflow nodes store stable marker/member IDs and resolve the latest locator at execution time.

**Tech Stack:** Chrome Extension MV3, TypeScript, Vue 3, IndexedDB, content scripts, Record & Replay V3.

**Spec:** `docs/superpowers/specs/2026-10-01-element-marker-expansion-design.md`

## Global Constraints

- Preserve existing `selector`, `selectorType`, `listMode`, URL matching, and workflow selector behavior for legacy records.
- Persist iframe ancestry by iframe selectors and observed URLs, never by transient `frameId`.
- Store grouped members as independently addressable locators; workflow click/fill requires one member, while extraction may use all members.
- Selector repair updates an existing marker/member identity so linked workflows read the repaired locator on their next run.
- Keep preview and extraction bounded at 100 members.
- Do not add or run automated tests unless the user requests them.
- Preserve all pre-existing working-tree changes and test files.

---

### Task 1: Extend marker model and persistence

**Files:**

- Modify: `app/chrome-extension/common/element-marker-types.ts`
- Modify: `app/chrome-extension/entrypoints/background/element-marker/element-marker-storage.ts`
- Modify: `app/chrome-extension/entrypoints/background/element-marker/index.ts`
- Modify: `app/chrome-extension/common/message-types.ts`

**Interfaces:**

- Add `ElementMarkerMember` with `id`, `name`, `selector`, `selectorType`, optional `framePath` entries `{ selector, url? }`, and optional `tagName`.
- Add optional `groupId`, `groupName`, `tags`, and `members` to marker and upsert types.
- Add background operations to validate a marker/member, reselect/update locator data, and apply group rename/tag updates while preserving IDs.
- Old records without these fields remain valid and are interpreted as one member from their legacy top-level locator.

- [x] Add the new types and validation result union (`normal`, `multiple`, `invalid`) without changing existing field meanings.
- [x] Make storage validate group/member/tag payloads, persist optional fields, preserve `createdAt` on update, and return normalized singleton members only at read/use boundaries.
- [x] Add typed message names and background handlers for member-aware validation and group metadata updates.
- [x] Run focused Prettier and ESLint on the touched TypeScript files, then inspect `git diff --check`.

### Task 2: Complete selection, preview, grouping, and iframe aggregation

**Files:**

- Modify: `app/chrome-extension/inject-scripts/element-marker.js`
- Modify: `app/chrome-extension/entrypoints/background/element-marker/index.ts`

**Interfaces:**

- Overlay selection entries use the member shape from Task 1 plus a temporary live element handle only inside the owning frame.
- Frame messages carry selection operation, frame ancestry, member locator, and display metadata; the top frame owns the aggregate list.

- [x] Build frame ancestry by walking from the current frame to the top and recording a stable selector and URL for every iframe boundary.
- [x] Aggregate Ctrl toggles and Shift commits in the top frame by `{ framePath, selector, selectorType }`, deduplicate repeated targets, and preserve existing same-frame selection behavior.
- [x] Add Shift-hover preview scoped to nearest `table`, list, `main`, `article`, `form`, or `fieldset`; expose page-wide scope and cap preview at 100.
- [x] Make every selection row show its name and count, support remove/clear, and locate a row by relaying a highlight request down its iframe path.
- [x] Add group-save and separate-save modes. Group-save writes one marker with members; separate-save writes one record per member with editable names and shared group metadata.
- [x] Handle missing or inaccessible frames with an explicit row status while allowing other selected frames to save.
- [x] Run focused Prettier and ESLint on the content script and background handler, then inspect the diff.

### Task 3: Validate markers and repair stale locators

**Files:**

- Modify: `app/chrome-extension/entrypoints/background/element-marker/index.ts`
- Modify: `app/chrome-extension/entrypoints/sidepanel/App.vue`
- Modify: `app/chrome-extension/inject-scripts/element-marker.js`

**Interfaces:**

- Validation responses return per-member match counts and states: `normal` (1), `multiple` (>1), or `invalid` (0/unreachable frame).
- Repair accepts marker ID and optional member ID, then updates only that locator while preserving names, group, tags, and identity.

- [x] Validate each member in its owning frame and aggregate group state using the spec precedence: invalid, then multiple, then normal.
- [x] Validate markers for the active URL when the manager opens or active tab changes; include a manual refresh action.
- [x] Display the three Chinese states and per-member counts in the side panel.
- [x] Add a repair action that starts the picker; selecting a replacement updates the marker/member by stable ID and immediately refreshes its validation state.
- [x] Run focused Prettier and ESLint on the touched files, then inspect `git diff --check`.

### Task 4: Add group/tag management and multi-value extraction

**Files:**

- Modify: `app/chrome-extension/inject-scripts/element-marker.js`
- Modify: `app/chrome-extension/entrypoints/sidepanel/App.vue`
- Modify: `app/chrome-extension/entrypoints/background/element-marker/index.ts`

**Interfaces:**

- Extraction input is marker IDs/member IDs and value kind `text | href | src | value`.
- Extraction output is ordered rows with marker name, page/frame context, value, and an optional member error.

- [x] Add group name and comma-separated tag editing in the marker editor, including group-wide rename for shared `groupId` records.
- [x] Add group and tag filters while retaining existing domain, URL, and text search behavior.
- [x] Add extraction controls for selected members or a full group and extract through the frame path for each member.
- [x] Copy extracted rows as TSV and download CSV with UTF-8 BOM and proper field quoting; preserve row alignment when one member is unavailable.
- [x] Run focused Prettier, ESLint, and TypeScript checks on the touched files, then inspect the diff.

### Task 5: Reference saved markers from workflow actions

**Files:**

- Modify: `app/chrome-extension/entrypoints/background/record-replay-v3/actions/types.ts`
- Modify: `app/chrome-extension/entrypoints/background/record-replay-v3/actions/handlers/common.ts`
- Modify: `app/chrome-extension/entrypoints/background/record-replay-v3/actions/handlers/click.ts`
- Modify: `app/chrome-extension/entrypoints/background/record-replay-v3/actions/handlers/fill.ts`
- Modify: `app/chrome-extension/entrypoints/background/record-replay-v3/actions/handlers/extract.ts`
- Modify: `app/chrome-extension/entrypoints/popup/components/builder/components/properties/PropertyClick.vue`
- Modify: `app/chrome-extension/entrypoints/popup/components/builder/components/properties/PropertyFill.vue`
- Modify: `app/chrome-extension/entrypoints/popup/components/builder/components/properties/PropertyExtract.vue`
- Modify: `app/chrome-extension/entrypoints/background/element-marker/element-marker-storage.ts`

**Interfaces:**

- Extend workflow element targets with optional `markerId` and `memberId`.
- Add a background-safe storage lookup that returns the current locator by marker/member ID.
- Click/fill must resolve one member. Extract may resolve one member or all members in a group.

- [x] Add marker-reference fields to action target types while retaining the existing selector candidate union.
- [x] Add a marker selector control to click, fill, and selector-extract properties; filter available markers by current flow/page context and require a member choice for grouped click/fill.
- [x] Resolve marker IDs immediately before action execution. Convert the latest CSS/XPath locator and frame path into the existing action target and frame ID; report missing marker/member as `TARGET_NOT_FOUND` with its name.
- [x] Extend selector extraction to return an array for all group members and support the four marker extraction value kinds without affecting existing direct-selector extraction.
- [x] Run focused Prettier, ESLint, and TypeScript checks on the touched files, then inspect the diff.

### Task 6: Verify integration and compatibility

**Files:**

- Inspect all files listed above and the complete working-tree diff.

- [x] Confirm legacy marker CRUD, highlighting, validation, and workflow nodes still use their original paths when optional marker fields are absent.
- [x] Confirm group/member locators are never flattened across different iframe paths and that temporary iframe IDs are not stored.
- [x] Run focused Prettier and ESLint for changed files, `pnpm run typecheck`, `pnpm run build`, and `git diff --check`.
- [x] Review build warnings separately from build exit status and report any pre-existing third-party warnings.
