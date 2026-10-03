# Element Marker Expansion Design

## Goal

Expand the existing Chrome extension element marker into a maintainable annotation workflow: manage multi-selection as a named group or as individually named markers, preview similar targets, validate and repair stale selectors, extract tabular data, organize markers with groups and tags, select elements across iframe boundaries, and reference saved markers from workflow actions.

## Existing System

Element markers are stored as records in the `element_marker_storage` IndexedDB database and are exposed through background runtime messages. Existing records contain one `selector`, a selector type, a URL match policy, and a `listMode` flag. The injected `element-marker.js` owns the annotation overlay and selection state. The side panel lists and edits saved markers. Record & Replay V3 workflow nodes configure selectors directly; click, fill, and extract handlers consume those selector fields.

## Data Model and Compatibility

Extend `ElementMarker` with optional `groupId`, `groupName`, `tags`, and `members` fields. Optional fields keep existing IndexedDB records readable without a destructive migration. `members` is an ordered array of named element locators. Each member contains a stable member ID, display name, selector and selector type, and an optional iframe path. An iframe path is a top-to-bottom sequence of iframe CSS selectors and observed URLs; it must not use a runtime-only frame ID as its persisted identity.

Keep the existing top-level `selector`, `selectorType`, and `listMode` fields. For legacy markers with no `members`, consumers treat the top-level fields as a single member. For grouped markers, new marker-aware code treats `members` as canonical; the top-level selector remains a compatibility locator for the first member. Group validation and extraction operate on members individually so mixed iframe paths and disjoint selectors are never combined into a misleading selector string.

There are two save modes:

- **Save as group:** create one marker with a group name and an ordered `members` array. Each member is individually named and can be highlighted, validated, extracted, or selected as a workflow target.
- **Save separately:** create one marker record per selected element. Records share a generated `groupId`, the entered group name, and tags. Each record has its own selector and marker ID.

Both modes allow page matching policy and tags. Existing marker IDs and timestamps keep their current meaning. Updating a locator in the management UI retains its marker ID so workflows linked to it continue to use the updated locator.

## Annotation Overlay

The selected-elements list displays count, name, and a locate action for each element. Users can remove one element or clear the selection. Locate highlights the element in its owning frame without closing the picker. The save controls offer group save and separate save; separate save exposes editable names per row and uses one shared group name.

Ctrl-click toggles any element into or out of the current selection. Shift-hover previews similar elements before selection; Shift-click commits them. Similar-element resolution is scoped by default to the nearest semantic container (`table`, list, `main`, `article`, `form`, or `fieldset`) that contains the hovered element, with a page-wide option. Preview is capped at 100 targets to keep the overlay responsive. The preview count and scope are visible before committing.

Selections from child frames are sent to the top-frame overlay with their complete iframe path and member locator. The top overlay aggregates, removes, locates, previews, and saves frame members through the same member interface used for main-frame elements. Frame messages are accepted only from a window in the current iframe ancestry and are validated against the source iframe; they do not rely on unrestricted origins as an identity check.

## Validation and Repair

The marker manager can validate the current-page markers and displays one of three states per marker or member:

- **`normal`:** exactly one element matches.
- **`multiple`:** more than one element matches.
- **`invalid`:** no element matches or its iframe path cannot be resolved.

Validation runs when the marker manager is opened for the current page, after the active tab URL changes, and when the user requests a manual refresh. It is not a continuous MutationObserver, avoiding repeated scans while a page is changing. Group status is `invalid` if any member is missing, otherwise `multiple` if any member has multiple matches, otherwise `normal`.

The repair action starts element selection on the active page. Re-selecting a group member updates only that member's locator and preserves its member ID, name, group, and tags. Re-selecting an independent marker updates its selector in place and preserves its marker ID. A user can validate the repaired locator immediately.

## Data Extraction and CSV

Users can extract selected marker members or all members in a group using one of four value types: visible text, link URL (`href`), image URL (`src`), or form value (`value`). Extraction returns one row per member with marker name, URL/frame context, and the selected value. The overlay can copy tab-separated rows or download a UTF-8 CSV with a byte-order mark and standard quoted-field escaping. Missing members produce an error row with an empty value rather than shifting later columns.

## Groups and Tags

`groupId` and `groupName` represent a user-defined collection such as "Login", "Product list", or "Order actions". `tags` is an array of free-form labels for cross-cutting uses such as "read", "critical path", or "regression". The side panel supports group and tag filtering, keeps URL/domain filtering, and shows group membership. Renaming a group updates all independent markers that share its `groupId`; it does not alter their selectors or IDs.

## Workflow Integration

Click, fill, and selector-based extract nodes gain a marker picker. A saved single marker is referenced by `markerId`; a grouped marker additionally requires a `memberId` for click and fill. Group extraction may target a chosen member or all group members. The workflow configuration retains a marker reference rather than copying a selector snapshot.

Immediately before executing an opted-in action, the runner loads the current marker from IndexedDB, resolves its current selector and iframe path, and then uses the existing locator/action handler. Therefore editing or repairing a marker updates linked workflows on their next run. Missing markers or members fail the step with a message that names the missing marker. Existing workflow nodes that store direct selectors remain unchanged.

## Error Handling and Limits

Selectors are validated before being saved or applied. Unsupported, inaccessible, or cross-origin frames that cannot be reached by the extension show an explicit unavailable-frame state and do not block annotations in accessible frames. Similar preview and data extraction are bounded to 100 members per request. CSV values are escaped according to CSV rules. Empty group names, duplicate member IDs, invalid tag values, and malformed iframe paths are rejected at the background storage boundary.

## Validation

Verification covers legacy marker reads, group and separate persistence, per-member validation and repair, selection preview and row actions, same-origin and cross-origin iframe handling where extension permissions allow it, CSV quoting and multi-value extraction, side-panel group/tag filters, and dynamic workflow resolution after a marker update or deletion.

## Non-Goals

- Automatically rewriting selectors with AI or guessing a replacement without user confirmation.
- Continuous DOM mutation scanning.
- Changing the existing workflow action model for nodes that do not reference markers.
- Migrating or deleting existing marker records.
