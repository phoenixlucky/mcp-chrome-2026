# Property Panel UI Refactor Plan

## Background

The current property panel UI differs significantly from the design mockup `attr-ui.html`. This document plans the refactor in detail, ordered from highest to lowest priority, with the goal of making the property panel's visuals and interactions match the design mockup.

### Reference files

- **Design mockup**: `/attr-ui.html`
- **Current styles**: `ui/shadow-host.ts`
- **Panel structure**: `ui/property-panel/property-panel.ts`
- **Control components**: `ui/property-panel/controls/*.ts`

---

## Prerequisites (done)

### 0.1 Minimize bug fix ✅

**Problem**: when the toolbar and property panel were minimized, only the background disappeared; the content was actually still there

**Root cause**: `display: flex/inline-flex` in CSS overrode the default `display: none` of the `[hidden]` attribute

**Solution**:

- [x] Add a global `[hidden] { display: none !important; }` rule at the end of `shadow-host.ts`

### 0.2 Input optimization ✅

**Problem**:

1. Inputs showed the placeholder instead of the real value
2. Number inputs did not support keyboard up/down stepping

**Solution**:

- [x] Create the `ui/property-panel/controls/number-stepping.ts` utility module
  - Support ArrowUp/ArrowDown keyboard stepping
  - Support Shift (10x) and Alt (0.1x) modifiers
  - Support multiple CSS units (px, %, rem, em, vh, vw, vmin, vmax)
- [x] Change all controls to show the real value (inline first, fallback to computed)
- [x] Add keyboard stepping to all numeric inputs:
  - `size-control.ts` - Width/Height
  - `spacing-control.ts` - Margin/Padding
  - `position-control.ts` - Top/Right/Bottom/Left/Z-Index
  - `layout-control.ts` - Gap
  - `typography-control.ts` - Font Size/Line Height
  - `appearance-control.ts` - Opacity/Border Radius/Border Width

---

## Phase 1: Base visual system alignment ✅ done

### 1.1 Color scheme refactor ✅

**Goal**: shift the color system from the current gray to the design's white background + gray input style

| Property     | Old value         | New value                             | Status |
| ------------ | ----------------- | ------------------------------------- | ------ |
| Panel bg     | `#f8f8f8`         | `#ffffff`                             | ✅     |
| Input bg     | `#f0f0f0`         | `#f3f3f3`                             | ✅     |
| Input hover  | `#e8e8e8` (bg)    | `border #e0e0e0` (inset)              | ✅     |
| Input focus  | `box-shadow` ring | `inset 2px border #3b82f6` + white bg | ✅     |
| Border color | `#e8e8e8`         | `#e5e5e5`                             | ✅     |

**Completed tasks**:

- [x] Update the CSS variable definitions (`shadow-host.ts:56-97`)
- [x] Change the input hover/focus styles to the inset border pattern
- [x] Make the panel background pure white

### 1.2 Font and font size adjustments ✅

| Property        | Old value | New value                    | Status |
| --------------- | --------- | ---------------------------- | ------ |
| Panel base size | `13px`    | `11px`                       | ✅     |
| Label size      | `11px`    | `10px`                       | ✅     |
| Input size      | `12px`    | `11px`                       | ✅     |
| Font family     | System    | Inter + system font fallback | ✅     |

**Completed tasks**:

- [x] Add the Inter font declaration (with system font fallback)
- [x] Adjust the font sizes of the panel, labels, and inputs
- [x] Remove the uppercase style from labels

### 1.3 Spacing and margin adjustments ✅

| Property       | Old value   | New value  | Status |
| -------------- | ----------- | ---------- | ------ |
| Panel width    | `320px`     | `280px`    | ✅     |
| Header padding | `10px 14px` | `8px 12px` | ✅     |
| Body gap       | `10px`      | `12px`     | ✅     |

**Completed tasks**:

- [x] Adjust the padding/gap of `.we-panel`, `.we-prop-body`, `.we-field-group`
- [x] Adjust the header padding

### 1.4 Corner radius and shadows ✅

| Property     | Old value   | New value          | Status |
| ------------ | ----------- | ------------------ | ------ |
| Panel shadow | `0 1px 2px` | Tailwind shadow-xl | ✅     |
| Input radius | `6px`       | `4px`              | ✅     |
| Tab shadow   | none        | `shadow-sm`        | ✅     |

**Completed tasks**:

- [x] Strengthen the panel shadow (double-layer shadow emulating shadow-xl)
- [x] Change the input radius to 4px
- [x] Add a shadow to the active Tab

### 1.5 Group/Section style refactor ✅

| Property        | Old style    | New style   | Status |
| --------------- | ------------ | ----------- | ------ |
| Group border    | Card border  | No border   | ✅     |
| Section divider | none         | Top divider | ✅     |
| Header style    | Bold + large | 11px + #333 | ✅     |

**Completed tasks**:

- [x] Remove the border and background of `.we-group`
- [x] Add a divider between Sections (`border-top`)
- [x] Adjust the Group header style

---

## Phase 2: Input container component refactor ✅ basics done

### 2.1 Build the input container system ✅

**Background**: the design's inputs are not a single input but a container system that supports:

- Prefix: label, icon
- Suffix: unit, icon
- Container-driven hover/focus styles

**Current structure**:

```html
<div class="we-field">
  <span class="we-field-label">Width</span>
  <input class="we-input" />
</div>
```

**Target structure**:

```html
<div class="we-field">
  <span class="we-field-label">Position</span>
  <div class="we-input-container">
    <!-- new container -->
    <span class="we-input-container__prefix">X</span>
    <!-- optional prefix -->
    <input class="we-input-container__input" />
    <span class="we-input-container__suffix">px</span>
    <!-- optional suffix -->
  </div>
</div>
```

**Completed**:

- [x] Define `.we-input-container` styles in `shadow-host.ts`
- [x] Define `.we-input-container__prefix` and `.we-input-container__suffix` styles
- [x] Create the `ui/property-panel/components/input-container.ts` component
- [x] Move the hover/focus styles to the container level (using `:focus-within`)

### 2.2 Update each Control to use the new container ✅ done

**Controls to update**:

- [x] `size-control.ts` - Width/Height (2-column layout + W/H prefixes + dynamic unit suffix)
- [x] `spacing-control.ts` - Margin/Padding (refactored into a 2x2 grid + direction icons + dynamic unit suffix)
- [x] `position-control.ts` - Top/Right/Bottom/Left/Z-Index (T/R/B/L prefixes + dynamic unit suffix)
- [x] `layout-control.ts` - Gap (icon prefix + dynamic unit suffix)
- [x] `typography-control.ts` - Font Size/Line Height (dynamic unit suffix, smart line-height display)
- [ ] `appearance-control.ts` - Opacity/Border Radius/Border Width (to be implemented)

**Completed shared modules**:

- [x] Create the `css-helpers.ts` shared module (extractUnitSuffix, hasExplicitUnit, normalizeLength)
- [x] All controls use the shared helpers, eliminating duplicated code

---

## Phase 3: Section structure refactor (to be implemented)

### 3.1 Tab information architecture adjustment

**Current**: 4 tabs (Design/CSS/Props/DOM)
**Design mockup**: 2 tabs (Design/CSS)

**Options**:

- **Option A**: keep 4 tabs, turn them into an overflow menu
- **Option B**: move Props/DOM to another entry point
- **Option C**: keep 4 tabs, adjust the styles to fit

**Tasks**:

- [ ] Decide on the number of tabs (product decision)
- [ ] Implement the chosen option

---

## Phase 4: Feature component implementation (to be implemented)

### 4.1 Flow layout icon group ✅ done

**Design mockup location**: `attr-ui.html:133-156`
**Feature**: 4 icon buttons controlling `flex-direction`

```
[→] Row
[↓] Column
[←] Row Reverse
[↑] Column Reverse
```

**Completed**:

- [x] Create the generic `ui/property-panel/components/icon-button-group.ts` component
- [x] Add `.we-icon-button-group` styles in `shadow-host.ts`
- [x] Replace the Direction select in `layout-control.ts` with the icon group
- [x] Add the corresponding SVG arrow icons (row/column/row-reverse/column-reverse)

### 4.2 Alignment 3x3 grid ✅ done

**Design mockup location**: `attr-ui.html:166-208`
**Feature**: 3x3 grid controlling `justify-content` + `align-items`

```
[↖][↑][↗]
[←][·][→]
[↙][↓][↘]
```

**Completed**:

- [x] Create the `ui/property-panel/components/alignment-grid.ts` component
- [x] Add `.we-alignment-grid` styles in `shadow-host.ts`
- [x] Replace the Justify/Align selects in `layout-control.ts`
- [x] Use `beginMultiStyle` for atomic commit of both properties

### 4.3 Fix Color Picker ✅ partially done

**Current problems**:

- `showPicker()` has no try/catch and may throw
- The alpha channel is dropped
- Token values `var(--xxx)` display incorrectly

**Completed**:

- [x] Add error handling for `showPicker()` (try/catch + fallback to click)
- [x] Improve parsing and display of `var()` values (pass the computed value through the placeholder)

**To be implemented**:

- [ ] Support the alpha channel (RGBA/HSLA) - requires a third-party color picker
- [ ] Consider a third-party color picker (e.g. `@simonwep/pickr`)

---

## Phase 5: New feature modules (to be implemented)

### 5.1 Shadow & Blur control

**Design mockup location**: `attr-ui.html:396-425`
**Features**:

- Enable/disable switch
- Type selection (Drop shadow/Inner shadow/Layer Blur/Backdrop Blur)
- Visibility control

**CSS properties**:

- `box-shadow`
- `filter: blur()`
- `backdrop-filter: blur()`

**Tasks**:

- [x] Create `ui/property-panel/controls/effects-control.ts`
- [x] Implement `box-shadow` value parsing and editing
- [x] Implement `filter` value parsing and editing
- [x] Implement `backdrop-filter` value parsing and editing
- [x] Add the type switch UI
- [ ] Add the enable/disable switch (optional, later)

### 5.2 Gradient editor

**Design mockup location**: `attr-ui.html:269-325`
**Features**:

- Linear/Radial gradient types
- Color stops
- Angle control
- Flip button

**CSS properties**:

- `background-image: linear-gradient(...)`
- `background-image: radial-gradient(...)`

**Tasks**:

- [x] Create `ui/property-panel/controls/gradient-control.ts`
- [x] Implement gradient value parsing (CSS gradient → data structure)
- [x] Implement angle/position inputs
- [x] Implement editing of 2 color stops
- [x] Integrate into property-panel (as a standalone Gradient field group)
- [ ] Implement the gradient preview slider (optional, later optimization)
- [ ] Implement color stop add/remove/drag (optional, later optimization)

### 5.3 Token/variable pill display

**Design mockup location**: `attr-ui.html:374-384`
**Feature**: when the value is a CSS variable, display it as a clickable pill

**Tasks**:

- [ ] Detect `var(--xxx)` values
- [ ] Render as a pill style
- [ ] Click opens the token picker

---

## Phase 6: Code quality (throughout)

### 6.1 Unify the style system

- [x] All colors use CSS variables (done in Phase 1)
- [ ] All dimensions use consistent tokens
- [ ] Remove inline styles, unify into `shadow-host.ts`

### 6.2 Component reuse

- [ ] Extract generic components into `ui/property-panel/components/`
- [ ] Unify the event handling pattern
- [ ] Unify disabled/enabled state handling

### 6.3 Type safety

- [ ] All components use strict TypeScript types
- [ ] Define clear interfaces and types
- [ ] Remove any type assertions

---

## Implementation progress

| Phase | Task                         | Status            | Notes                                                 |
| ----- | ---------------------------- | ----------------- | ----------------------------------------------------- |
| 0.1   | Minimize bug fix             | ✅                | Added the global `[hidden]` rule                      |
| 0.2   | Input optimization           | ✅                | number-stepping + real value display                  |
| 1.1   | Color scheme refactor        | ✅                | White bg + gray inputs + inset focus                  |
| 1.2   | Font and size tweaks         | ✅                | 11px baseline + Inter font                            |
| 1.3   | Spacing and margin           | ✅                | Tighter layout                                        |
| 1.4   | Radius and shadows           | ✅                | shadow-xl + 4px radius                                |
| 1.5   | Group/Section styles         | ✅                | Divider style                                         |
| 2.1   | Input container system       | ✅                | Component + CSS styles                                |
| 2.2   | Update Controls              | ✅                | All main controls migrated, shared css-helpers.ts     |
| 3.1   | Tab information architecture | To be implemented |                                                       |
| 4.1   | Flow icon group              | ✅                | icon-button-group.ts + integrated into layout-control |
| 4.2   | Alignment 3x3 grid           | ✅                | alignment-grid.ts + integrated into layout-control    |
| 4.3   | Fix Color Picker             | ✅ partial        | showPicker error handling + var() parsing             |
| 5.1   | Shadow & Blur                | ✅                | effects-control.ts + integrated into property-panel   |
| 5.2   | Gradient editor              | ✅                | gradient-control.ts + integrated into property-panel  |
| 5.3   | Token Pill                   | To be implemented |                                                       |

---

## Notes

1. **Incremental implementation**: each Phase should be independently testable and shippable when done
2. **Stay backward compatible**: the refactor must not break existing features
3. **Record design decisions**: when the design mockup conflicts with real requirements, record the reasons for the decision
4. **Performance**: new components must consider render performance and avoid unnecessary DOM operations
