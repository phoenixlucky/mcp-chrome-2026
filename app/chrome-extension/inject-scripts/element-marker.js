(function () {
  if (window.__ELEMENT_MARKER_INSTALLED__) return;
  window.__ELEMENT_MARKER_INSTALLED__ = true;

  const IS_MAIN = window === window.top;

  // ============================================================================
  // Utility Functions
  // ============================================================================

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Constants & Configuration
  // ============================================================================

  const CONFIG = {
    DEFAULTS: {
      PREFS: {
        preferTestId: true,
        preferAria: true,
        preferText: false,
        preferId: true,
        preferStableAttr: true,
        preferClass: false,
      },
      SELECTOR_TYPE: 'css',
      LIST_MODE: false,
    },
    Z_INDEX: {
      OVERLAY: 2147483646,
      HIGHLIGHTER: 2147483645,
      RECTS: 2147483644,
    },
    COLORS: {
      PRIMARY: '#2563eb',
      SUCCESS: '#10b981',
      WARNING: '#f59e0b',
      DANGER: '#ef4444',
      HOVER: '#10b981',
      VERIFY: '#3b82f6',
    },
  };

  const TEST_ID_ATTRIBUTES = [
    'data-testid',
    'data-testId',
    'data-test',
    'data-qa',
    'data-cy',
    'data-pw',
  ];
  const ACCESSIBLE_ATTRIBUTES = ['aria-label', 'aria-labelledby'];
  const STABLE_ATTRIBUTES = ['name', 'placeholder', 'title', 'alt'];

  // ============================================================================
  // Panel Host Module - Shadow DOM Management
  // ============================================================================

  const PanelHost = (() => {
    let hostElement = null;
    let shadowRoot = null;

    const PANEL_STYLES = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .em-panel {
        position: relative;
        width: min(520px, calc(100vw - 24px));
        max-height: calc(100vh - 24px);
        overflow-y: auto;
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.06);
        border-radius: 14px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 14px;
        transition: opacity 150ms ease;
      }


      /* Header */
      .em-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        user-select: none;
      }

      .em-title {
        font-size: 16px;
        font-weight: 650;
        color: #262626;
      }

      .em-header-actions {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .em-icon-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        color: #a3a3a3;
        cursor: pointer;
        transition: color 150ms ease;
        padding: 0;
      }

      .em-icon-btn:hover {
        color: #525252;
      }

      .em-icon-btn svg {
        width: 20px;
        height: 20px;
        stroke-width: 2;
      }

      /* Controls Row */
      .em-controls {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
      }

      .em-select-wrapper {
        flex: 1;
        position: relative;
      }

      .em-select {
        width: 100%;
        height: 38px;
        padding: 0 34px 0 12px;
        background: #f5f5f5;
        color: #262626;
        font-size: 13px;
        border: none;
        border-radius: 8px;
        appearance: none;
        cursor: pointer;
        outline: none;
        font-family: inherit;
        font-weight: 400;
      }

      .em-select-wrapper::after {
        content: '';
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid #737373;
        pointer-events: none;
      }

      .em-square-btn {
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background 150ms ease;
        padding: 0;
      }

      .em-square-btn:hover {
        background: #e5e5e5;
      }

      .em-square-btn.active {
        background: #2563eb;
      }

      .em-square-btn.active svg {
        color: #ffffff;
      }

      /* Validation is now part of the main form; keep the old tab toggle out of the toolbar. */
      #__em_toggle_tab {
        display: none;
      }

      .em-square-btn svg {
        width: 18px;
        height: 18px;
        color: #525252;
        stroke-width: 2;
      }

      /* Selector Display */
      .em-selector-display {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 8px 0 12px;
        background: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 10px;
      }

      .em-selector-display svg {
        width: 18px;
        height: 18px;
        color: #a3a3a3;
        flex-shrink: 0;
        stroke-width: 2;
      }

      .em-selector-text {
        flex: 1;
        font-size: 13px;
        color: #525252;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        user-select: text;
      }

      .em-selector-nav {
        display: flex;
        gap: 2px;
      }

      .em-behavior-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 28px;
        margin: -3px 0 9px;
        padding: 0 2px;
      }

      .em-behavior-label {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        color: #525252;
        font-size: 12px;
        cursor: pointer;
      }

      .em-behavior-label span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .em-behavior-label input {
        width: 16px;
        height: 16px;
        margin: 0;
        flex-shrink: 0;
        accent-color: #2563eb;
        cursor: pointer;
      }

      .em-behavior-hint {
        flex-shrink: 0;
        color: #a3a3a3;
        font-size: 11px;
      }

      .em-copy-element-text-btn {
        flex: 0 0 auto;
        min-width: 132px;
        height: 30px;
        padding: 0 10px;
        border: 1px solid #d4d4d4;
        border-radius: 6px;
        background: #f5f5f5;
        color: #404040;
        font-size: 12px;
        cursor: pointer;
        transition: all 150ms ease;
      }

      .em-copy-element-text-btn:hover {
        border-color: #a3a3a3;
        background: #e5e5e5;
      }

      .em-nav-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: background 150ms ease;
        border-radius: 6px;
        padding: 0;
      }

      .em-nav-btn:hover {
        background: #e5e5e5;
      }

      .em-nav-btn svg {
        width: 16px;
        height: 16px;
        color: #525252;
        stroke-width: 2;
      }

      /* Tabs */
      .em-tabs {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        background: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 10px;
      }

      /* Marking and validation share one compact flow instead of separate tabs. */
      .em-tabs {
        display: none;
      }

      .em-verify-content {
        display: block !important;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f0f0f0;
      }

      .em-verify-content > .em-settings {
        gap: 8px;
      }

      .em-verify-title {
        margin-bottom: 8px;
        color: #525252;
      }

      .em-verify-content > .em-settings > .em-settings-group:first-child {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr);
        align-items: center;
        gap: 8px;
      }

      .em-verify-content > .em-settings > .em-settings-group:first-child .em-settings-label {
        color: #525252;
      }

      .em-verify-content .em-actions {
        margin-top: 8px !important;
      }

      .em-verify-content #__em_execution_history {
        margin-top: 10px !important;
      }

      .em-tab {
        padding: 5px 13px;
        font-size: 12px;
        font-weight: 500;
        color: #737373;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 150ms ease;
      }

      .em-tab:hover {
        color: #404040;
      }

      .em-tab.active {
        color: #262626;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      /* Content */
      .em-content {
        margin-bottom: 0;
      }

      .em-annotation-layout {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .em-annotation-layout .em-section-title {
        margin-bottom: 8px;
      }

      .em-selection-list {
        margin-bottom: 12px;
        padding: 10px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fafafa;
      }

      .em-selection-list[hidden] {
        display: none;
      }

      .em-selection-list-header,
      .em-selection-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .em-selection-list-header {
        margin-bottom: 6px;
        color: #404040;
        font-size: 12px;
        font-weight: 600;
      }

      .em-selection-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 112px;
        overflow-y: auto;
      }

      .em-similar-preview-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 7px;
      }

      .em-similar-preview-status {
        min-height: 16px;
        margin-bottom: 6px;
        color: #2563eb;
        font-size: 11px;
      }

      .em-selection-member {
        display: flex;
        min-width: 0;
        flex: 1;
        align-items: center;
        gap: 6px;
      }

      .em-selection-name-input {
        width: 100%;
        min-width: 0;
        padding: 3px 5px;
        border: 1px solid transparent;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        font: inherit;
      }

      .em-selection-name-input:focus {
        border-color: #93c5fd;
        background: #ffffff;
        outline: none;
      }

      .em-selection-item {
        min-height: 28px;
        padding: 4px 6px;
        border-radius: 5px;
        background: #ffffff;
        color: #525252;
        font-size: 11px;
      }

      .em-selection-item-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .em-selection-remove,
      .em-selection-clear {
        flex: 0 0 auto;
        padding: 2px 5px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: #737373;
        font-size: 11px;
        cursor: pointer;
      }

      .em-selection-remove:hover,
      .em-selection-clear:hover {
        background: #fef2f2;
        color: #dc2626;
      }

      .em-selection-hint {
        margin: 7px 0 0;
        color: #737373;
        font-size: 11px;
      }

      .em-extract-controls {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 8px 0 12px;
      }

      .em-extract-controls[hidden] {
        display: none;
      }

      .em-extract-controls .em-select {
        flex: 1;
      }

      .em-extract-result {
        max-height: 100px;
        margin: 0 0 12px;
        padding: 8px;
        overflow: auto;
        border-radius: 6px;
        background: #f5f5f5;
        color: #404040;
        font-size: 11px;
        white-space: pre-wrap;
      }

      .em-extract-result[hidden] {
        display: none;
      }

      @media (max-width: 700px) {
        .em-panel {
          width: min(400px, calc(100vw - 24px));
          max-height: calc(100vh - 24px);
        }

        .em-annotation-layout {
          grid-template-columns: 1fr;
          gap: 16px;
        }
      }

      @media (max-width: 360px) {
        .em-checkbox-group {
          grid-template-columns: 1fr;
        }
      }

      #__em_tab_settings {
        max-height: min(60vh, 480px);
        overflow-y: auto;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
      }

      #__em_tab_settings::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
      }

      .em-section-title {
        font-size: 12px;
        color: #737373;
        margin-bottom: 8px;
        font-weight: 400;
      }

      .em-attributes {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .em-attribute {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .em-attribute-label {
        font-size: 12px;
        color: #a3a3a3;
        font-weight: 400;
      }

      .em-attribute-value {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        min-height: 36px;
        padding: 0 10px 0 12px;
        background: #f5f5f5;
        border-radius: 8px;
      }

      .em-attribute-value.editable {
        padding: 0 12px;
      }

      .em-attribute-value svg {
        width: 18px;
        height: 18px;
        stroke-width: 2;
        cursor: pointer;
        transition: color 150ms ease;
        flex-shrink: 0;
      }

      .em-attribute-value svg.copy-icon {
        color: #a3a3a3;
      }

      .em-attribute-value svg.copy-icon:hover {
        color: #525252;
      }

      .em-attribute-value svg.copy-icon.disabled {
        color: #d4d4d4;
        cursor: default;
      }

      .em-attribute-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        color: #404040;
        user-select: text;
      }

      .em-attribute-text.empty {
        color: #a3a3a3;
      }

      .em-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 14px;
        color: #404040;
        font-family: inherit;
        outline: none;
        padding: 0;
        height: 36px;
      }

      .em-input::placeholder {
        color: #a3a3a3;
      }

      /* Settings Panel */
      .em-settings {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .em-settings-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .em-settings-label {
        font-size: 11px;
        font-weight: 500;
        color: #737373;
      }

      .em-checkbox-group {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .em-checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        min-height: 29px;
        padding: 4px 6px;
        border: 1px solid #f0f0f0;
        border-radius: 7px;
        font-size: 12px;
        color: #404040;
        cursor: pointer;
      }

      .em-checkbox-label:hover {
        background: #fafafa;
        border-color: #e5e5e5;
      }

      .em-checkbox-label span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .em-checkbox-label em {
        display: inline-block;
        margin-left: 2px;
        padding: 1px 3px;
        border-radius: 3px;
        background: #eff6ff;
        color: #2563eb;
        font-size: 9px;
        font-style: normal;
        line-height: 1.2;
        vertical-align: 1px;
      }

      .em-checkbox-label input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
        margin: 0;
        flex-shrink: 0;
      }

      /* Action Buttons */
      .em-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .em-btn {
        flex: 1;
        height: 36px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 150ms ease;
      }

      .em-btn-primary {
        background: #2563eb;
        color: #ffffff;
      }

      .em-btn-primary:hover {
        background: #1d4ed8;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }

      .em-btn-success {
        background: #10b981;
        color: #ffffff;
      }

      .em-btn-success:hover {
        background: #059669;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }

      .em-btn-ghost {
        background: #f5f5f5;
        color: #404040;
      }

      .em-btn-ghost:hover {
        background: #e5e5e5;
      }

      .em-code-dialog {
        position: absolute;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.28);
        border-radius: 12px;
      }

      .em-code-dialog.open {
        display: flex;
      }

      .em-code-card {
        width: 100%;
        max-height: calc(100vh - 48px);
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
      }

      .em-code-header, .em-code-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .em-code-title {
        font-size: 16px;
        font-weight: 600;
        color: #262626;
      }

      .em-code-tabs {
        display: flex;
        gap: 4px;
      }

      .em-code-tab {
        padding: 6px 10px;
        border: 0;
        border-radius: 6px;
        background: #f5f5f5;
        color: #525252;
        cursor: pointer;
      }

      .em-code-tab.active {
        background: #2563eb;
        color: #ffffff;
      }

      .em-code-output {
        min-height: 160px;
        max-height: 50vh;
        margin: 0;
        padding: 12px;
        overflow: auto;
        background: #171717;
        border-radius: 8px;
        color: #e5e5e5;
        font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
        user-select: text;
      }

      /* Footer */
      .em-footer {
        font-size: 11px;
        color: #a3a3a3;
        text-align: center;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #f5f5f5;
      }

      .em-footer kbd {
        display: inline-block;
        padding: 2px 6px;
        background: #f5f5f5;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
        color: #737373;
      }

      /* Status */
      .em-status {
        font-size: 12px;
        padding: 8px 10px;
        border-radius: 8px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .em-status.idle {
        display: none;
      }

      .em-status.running {
        background: rgba(37, 99, 235, 0.1);
        color: #2563eb;
      }

      .em-status.success {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
      }

      .em-status.failure {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }

      /* Grid Layout */
      .em-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .em-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .em-field-label {
        font-size: 11px;
        color: #a3a3a3;
      }

      .em-field-input {
        height: 36px;
        padding: 0 10px;
        background: #f5f5f5;
        border: none;
        border-radius: 7px;
        font-size: 13px;
        color: #404040;
        font-family: inherit;
        outline: none;
      }

      .em-field-input:focus {
        background: #e5e5e5;
      }

      /* Details/Accordion */
      .em-details {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f5f5f5;
      }

      .em-details summary {
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #737373;
        padding: 8px 0;
        user-select: none;
        list-style: none;
      }

      .em-details summary::-webkit-details-marker {
        display: none;
      }

      .em-details summary:hover {
        color: #404040;
      }

      .em-details[open] summary {
        margin-bottom: 12px;
      }

      /* Dragging state */
      body[data-em-dragging] {
        user-select: none !important;
        cursor: grabbing !important;
      }

      body[data-em-dragging] * {
        cursor: grabbing !important;
      }

      /* SVG Icons */
      svg {
        fill: none;
        stroke: currentColor;
      }

      .em-drag-handle {
        cursor: grab;
      }

      .em-drag-handle:active {
        cursor: grabbing;
      }
    `;

    const PANEL_TEMPLATE = `
      <div class="em-panel" id="em_panel_root">
        <!-- Header -->
        <div class="em-header em-drag-handle" id="__em_drag_handle" title="Drag to move">
          <h2 class="em-title">Element marker</h2>
          <div class="em-header-actions">
            <button class="em-icon-btn" id="__em_close" title="Close">
              <svg viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Controls -->
        <div class="em-controls">
          <div class="em-select-wrapper">
            <select class="em-select" id="__em_selector_type">
              <option value="css">CSS selector (recommended)</option>
              <option value="xpath">XPath selector</option>
            </select>
          </div>
          <button class="em-square-btn" id="__em_toggle_list" title="List mode - batch mark similar elements" aria-label="List mode" aria-pressed="false">
            <svg viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <button class="em-square-btn" id="__em_toggle_box" title="Box selection - drag to select a page region" aria-label="Box selection" aria-pressed="false">
            <svg viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 9V5h4m8 0h4v4M4 15v4h4m8 0h4v-4M8 8h8v8H8z"/>
            </svg>
          </button>
          <button class="em-square-btn" id="__em_toggle_tab" title="Toggle execution panel">
            <svg viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>
        </div>

        <!-- Selector Display -->
        <div class="em-selector-display">
          <svg viewBox="0 0 24 24" id="__em_copy_selector" title="Copy locator">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          <span class="em-selector-text" id="__em_selector_text">Click a page element to mark</span>
          <div class="em-selector-nav">
            <button class="em-nav-btn" id="__em_nav_up" title="Select parent element">
              <svg viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/>
              </svg>
            </button>
            <button class="em-nav-btn" id="__em_nav_down" title="Select child element">
              <svg viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="em-behavior-row" title="When off, only the element is recorded and the site's click logic is not triggered">
          <label class="em-behavior-label">
            <input type="checkbox" id="__em_replay_click" />
            <span>Trigger page click after marking</span>
          </label>
          <button class="em-copy-element-text-btn" id="__em_copy_element_text" type="button">
            Get element text
          </button>
          <span class="em-behavior-hint">Used to open popups/dropdowns</span>
        </div>

        <!-- Tabs are kept in the template for compatibility; the unified form hides them. -->
        <div class="em-tabs">
          <button class="em-tab active" data-tab="attributes">Mark</button>
          <button class="em-tab" data-tab="execute">Validate</button>
        </div>

        <!-- Status -->
        <div class="em-status idle" id="__em_status"></div>

        <!-- Annotation content -->
        <div class="em-content" id="__em_tab_attributes">
          <div class="em-similar-preview-controls">
            <span class="em-section-title" style="margin: 0;">Shift multi-select scope</span>
            <select class="em-select" id="__em_selection_scope" aria-label="Similar element scope">
              <option value="region">Current table/list/region</option>
              <option value="page">Current page</option>
            </select>
          </div>
          <div class="em-similar-preview-status" id="__em_similar_preview_status"></div>
          <div class="em-selection-list" id="__em_selection_list" hidden>
            <div class="em-selection-list-header" id="__em_selection_count"></div>
            <div class="em-selection-list-header em-selection-list-actions">
              <button class="em-selection-clear" id="__em_clear_selection" type="button">Clear</button>
            </div>
            <div class="em-selection-items" id="__em_selection_items"></div>
            <p class="em-selection-hint">These elements are saved as one group marker</p>
          </div>
          <div class="em-extract-controls" id="__em_extract_controls" hidden>
            <select class="em-select" id="__em_extract_type" aria-label="Extract data type">
              <option value="text">Text</option>
              <option value="href">Link URL</option>
              <option value="src">Image URL</option>
              <option value="value">Input value</option>
            </select>
            <button class="em-selection-remove" id="__em_extract_selected" type="button">Extract</button>
            <button class="em-selection-remove" id="__em_copy_extract" type="button" hidden>Copy table</button>
            <button class="em-selection-remove" id="__em_download_extract" type="button" hidden>Export CSV</button>
          </div>
          <pre class="em-extract-result" id="__em_extract_result" hidden></pre>
          <div class="em-annotation-layout">
            <section>
              <h3 class="em-section-title">Selected elements</h3>
              <div class="em-attributes">
                <div class="em-attribute">
                  <div class="em-attribute-label" id="__em_name_label">Name</div>
                  <div class="em-attribute-value editable">
                    <input class="em-input" id="__em_name" placeholder="Element name" />
                  </div>
                </div>
                <div class="em-attribute">
                  <div class="em-attribute-label">Tags</div>
                  <div class="em-attribute-value editable">
                    <input class="em-input" id="__em_tags" placeholder="Comma-separated tags" />
                  </div>
                </div>
                <div class="em-attribute">
                  <div class="em-attribute-label">Locator</div>
                  <div class="em-attribute-value">
                    <svg class="copy-icon" viewBox="0 0 24 24" id="__em_copy" title="Copy locator">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                    <span class="em-attribute-text" id="__em_selector">-</span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 class="em-section-title">Locator preferences</h3>
              <div class="em-settings">
                <div class="em-checkbox-group">
                  <label class="em-checkbox-label">
                    <input type="checkbox" id="__em_pref_testid" checked />
                  <span>Test ID <em>recommended</em></span>
                  </label>
                  <label class="em-checkbox-label">
                    <input type="checkbox" id="__em_pref_aria" checked />
                  <span>Accessibility label <em>recommended</em></span>
                  </label>
                  <label class="em-checkbox-label">
                    <input type="checkbox" id="__em_pref_text" />
                    <span>Visible text (XPath)</span>
                  </label>
                  <label class="em-checkbox-label">
                    <input type="checkbox" id="__em_pref_id" checked />
                  <span>ID <em>recommended</em></span>
                  </label>
                  <label class="em-checkbox-label">
                    <input type="checkbox" id="__em_pref_attr" checked />
                  <span>Stable attributes <em>recommended</em></span>
                  </label>
                  <label class="em-checkbox-label">
                    <input type="checkbox" id="__em_pref_class" />
                    <span>Fallback to class name</span>
                  </label>
                </div>
                <div class="em-field-label">Order: test ID → accessibility label → visible text → ID → stable attributes → class name → structural path</div>
              </div>
            </section>
          </div>

          <div class="em-actions">
            <button class="em-btn em-btn-primary" id="__em_verify">Check match</button>
          </div>
        </div>

        <!-- Validation content is visible together with annotation content. -->
        <div class="em-content em-verify-content" id="__em_tab_execute" style="display: block;">
          <h3 class="em-section-title em-verify-title">Run validation</h3>
          <div class="em-settings">
            <div class="em-settings-group">
              <div class="em-settings-label">Validation action</div>
              <div class="em-select-wrapper">
                <select class="em-select" id="__em_action">
                  <option value="hover">Hover</option>
                  <option value="left_click">Left click</option>
                  <option value="double_click">Double click</option>
                  <option value="right_click">Right click</option>
                  <option value="scroll">Scroll</option>
                  <option value="type_text">Type text</option>
                  <option value="press_keys">Press keys</option>
                </select>
              </div>
            </div>

            <!-- Action-specific inputs (dynamically shown/hidden) -->
            <div class="em-settings-group" id="__em_action_text_group" style="display: none;">
              <div class="em-settings-label">Text</div>
              <input class="em-field-input" id="__em_action_text" placeholder="Text to type" />
            </div>

            <div class="em-settings-group" id="__em_action_keys_group" style="display: none;">
              <div class="em-settings-label">Keys</div>
              <input class="em-field-input" id="__em_action_keys" placeholder="e.g. Enter, Ctrl+C" />
            </div>

            <div class="em-settings-group" id="__em_scroll_options" style="display: none;">
              <div class="em-settings-label">Scroll direction</div>
              <div class="em-select-wrapper">
                <select class="em-select" id="__em_scroll_direction">
                  <option value="down">Down</option>
                  <option value="up">Up</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div class="em-field" style="margin-top: 8px;">
                <div class="em-field-label">Count (1-10, about 100px each)</div>
                <input class="em-field-input" id="__em_scroll_distance" type="number" min="1" max="10" step="1" value="3" />
              </div>
            </div>

            <!-- Click-specific options -->
            <div id="__em_click_options" style="display: none;">
              <div class="em-grid">
                <div class="em-field">
                  <div class="em-field-label">Mouse button</div>
                  <select class="em-select" id="__em_btn">
                    <option value="left">Left</option>
                    <option value="middle">Middle</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div class="em-field">
                  <div class="em-field-label">Timeout (ms)</div>
                  <input class="em-field-input" id="__em_nav_timeout" type="number" value="3000" />
                </div>
              </div>

              <div class="em-checkbox-group" style="margin-top: 12px;">
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_wait_nav" />
                  <span>Wait for page navigation</span>
                </label>
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_mod_alt" />
                  <span>Alt key</span>
                </label>
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_mod_ctrl" />
                  <span>Ctrl key</span>
                </label>
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_mod_meta" />
                  <span>Meta key</span>
                </label>
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_mod_shift" />
                  <span>Shift key</span>
                </label>
              </div>
            </div>

            <div class="em-actions" style="margin-top: 16px;">
              <button class="em-btn em-btn-primary" id="__em_execute">Run validation</button>
            </div>

            <!-- Execution History -->
            <div id="__em_execution_history" style="margin-top: 16px; display: none;">
              <div class="em-settings-label">Recent runs</div>
              <div id="__em_history_list" style="font-size: 12px; color: #737373; margin-top: 8px;"></div>
            </div>
          </div>
        </div>

        <div class="em-actions em-save-actions">
          <button class="em-btn em-btn-success" id="__em_save">Save marker</button>
          <button class="em-btn em-btn-ghost" id="__em_save_separate" hidden>Save with separate names</button>
          <button class="em-btn em-btn-ghost" id="__em_export">Export locator</button>
          <button class="em-btn em-btn-ghost" id="__em_cancel">Cancel</button>
        </div>

        <!-- Footer -->
        <div class="em-footer">
          Click or press <kbd>Space</kbd> to mark; <kbd>Ctrl</kbd> for arbitrary multi-select, <kbd>Shift</kbd> for same-type multi-select; the box selection button allows drag locate
        </div>

        <div class="em-code-dialog" id="__em_code_dialog" role="dialog" aria-modal="true" aria-label="Element locator code">
          <div class="em-code-card">
            <div class="em-code-header">
              <span class="em-code-title">Element locator code</span>
              <button class="em-icon-btn" id="__em_code_close" title="Close">×</button>
            </div>
            <div class="em-code-tabs">
              <button class="em-code-tab active" data-code-language="javascript">JavaScript</button>
              <button class="em-code-tab" data-code-language="python">Python (Selenium)</button>
            </div>
            <pre class="em-code-output" id="__em_code_output"></pre>
            <div class="em-code-actions">
              <span id="__em_code_hint">Copy directly into an automation script</span>
              <button class="em-btn em-btn-primary" id="__em_code_copy">Copy JavaScript</button>
            </div>
          </div>
        </div>
      </div>
    `;

    function mount() {
      if (hostElement) return { host: hostElement, shadow: shadowRoot };

      hostElement = document.createElement('div');
      hostElement.id = '__element_marker_overlay';
      Object.assign(hostElement.style, {
        position: 'fixed',
        top: '12px',
        right: '12px',
        zIndex: String(CONFIG.Z_INDEX.OVERLAY),
        pointerEvents: 'none',
      });

      shadowRoot = hostElement.attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = `<style>${PANEL_STYLES}</style>${PANEL_TEMPLATE}`;

      hostElement.querySelector = (...args) => shadowRoot.querySelector(...args);
      hostElement.querySelectorAll = (...args) => shadowRoot.querySelectorAll(...args);

      const panel = shadowRoot.querySelector('.em-panel');
      if (panel) {
        panel.style.pointerEvents = 'auto';
      }

      document.documentElement.appendChild(hostElement);
      return { host: hostElement, shadow: shadowRoot };
    }

    function unmount() {
      if (hostElement?.parentNode) {
        hostElement.parentNode.removeChild(hostElement);
      }
      hostElement = null;
      shadowRoot = null;
    }

    function getHost() {
      return hostElement;
    }

    function getShadow() {
      return shadowRoot;
    }

    return {
      mount,
      unmount,
      getHost,
      getShadow,
    };
  })();

  // ============================================================================
  // State Store Module - Centralized State Management
  // ============================================================================

  const StateStore = (() => {
    const state = {
      selectorType: CONFIG.DEFAULTS.SELECTOR_TYPE,
      listMode: CONFIG.DEFAULTS.LIST_MODE,
      boxSelect: false,
      replaySiteClick: false,
      prefs: { ...CONFIG.DEFAULTS.PREFS },
      activeTab: 'attributes',
      validation: {
        status: 'idle',
        message: '',
      },
      validationHistory: [], // Last 5 validation results
    };

    const listeners = new Set();

    function init() {
      return state;
    }

    function get(key) {
      return key ? state[key] : state;
    }

    function set(partial) {
      const changed = {};

      Object.keys(partial).forEach((key) => {
        if (JSON.stringify(state[key]) !== JSON.stringify(partial[key])) {
          changed[key] = true;
          state[key] = partial[key];
        }
      });

      if (Object.keys(changed).length === 0) return;

      if (changed.validation) {
        updateValidationUI();
      }
      if (changed.activeTab) {
        updateTabUI();
      }
      if (changed.listMode) {
        updateListModeUI();
      }
      if (changed.boxSelect) {
        updateBoxSelectUI();
      }
      if (changed.validationHistory) {
        updateValidationHistoryUI();
      }

      notifyListeners();
    }

    function subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }

    function notifyListeners() {
      listeners.forEach((cb) => {
        try {
          cb(state);
        } catch (err) {
          console.error('[StateStore] Listener error:', err);
        }
      });
    }

    function updateValidationUI() {
      const statusEl = PanelHost.getShadow()?.getElementById('__em_status');
      if (!statusEl) return;

      const { status, message } = state.validation;
      statusEl.className = `em-status ${status}`;
      statusEl.textContent = message;
    }

    function updateListModeUI() {
      const shadow = PanelHost.getShadow();
      if (!shadow) return;

      const btn = shadow.getElementById('__em_toggle_list');
      if (!btn) return;

      if (state.listMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.setAttribute('aria-pressed', String(state.listMode));
    }

    function updateBoxSelectUI() {
      const btn = PanelHost.getShadow()?.getElementById('__em_toggle_box');
      if (btn) {
        btn.classList.toggle('active', state.boxSelect);
        btn.setAttribute('aria-pressed', String(state.boxSelect));
      }
    }

    function updateTabUI() {
      const shadow = PanelHost.getShadow();
      if (!shadow) return;

      const tabs = shadow.querySelectorAll('.em-tab');
      tabs.forEach((tab) => {
        if (tab.dataset.tab === state.activeTab) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      const attrContent = shadow.getElementById('__em_tab_attributes');
      const executeContent = shadow.getElementById('__em_tab_execute');

      if (attrContent)
        attrContent.style.display = state.activeTab === 'attributes' ? 'block' : 'none';
      if (executeContent)
        executeContent.style.display = state.activeTab === 'execute' ? 'block' : 'none';

      // Sync interaction mode when tab changes
      syncInteractionMode();
    }

    function updateValidationHistoryUI() {
      const shadow = PanelHost.getShadow();
      if (!shadow) return;

      const historyContainer = shadow.getElementById('__em_execution_history');
      const historyList = shadow.getElementById('__em_history_list');
      if (!historyContainer || !historyList) return;

      if (state.validationHistory.length === 0) {
        historyContainer.style.display = 'none';
        return;
      }

      historyContainer.style.display = 'block';
      historyList.innerHTML = state.validationHistory
        .slice(-5)
        .reverse()
        .map((entry) => {
          const icon = entry.success ? '✓' : '✗';
          const color = entry.success ? '#10b981' : '#ef4444';
          const timestamp = new Date(entry.timestamp).toLocaleTimeString();
          const actionName =
            {
              hover: 'Hover',
              left_click: 'Left click',
              double_click: 'Double click',
              right_click: 'Right click',
              scroll: 'Scroll',
              type_text: 'Type text',
              press_keys: 'Press keys',
            }[entry.action] || entry.action;
          return `<div style="padding: 6px 0; border-bottom: 1px solid #f5f5f5;">
            <span style="color: ${color}; font-weight: 600;">${icon}</span>
            <span style="margin-left: 6px;">${actionName}</span>
            <span style="float: right; color: #a3a3a3; font-size: 11px;">${timestamp}</span>
          </div>`;
        })
        .join('');
    }

    return {
      init,
      get,
      set,
      subscribe,
    };
  })();

  // ============================================================================
  // Drag Controller Module
  // ============================================================================

  const DragController = (() => {
    let dragging = false;
    let startPos = { x: 0, y: 0 };
    let startOffset = { top: 0, right: 0 };

    function init(handleElement) {
      if (!handleElement) return;
      handleElement.addEventListener('mousedown', onDragStart);
    }

    function onDragStart(event) {
      event.preventDefault();
      dragging = true;

      const host = PanelHost.getHost();
      if (!host) return;

      startPos = { x: event.clientX, y: event.clientY };
      startOffset = {
        top: parseInt(host.style.top) || 0,
        right: parseInt(host.style.right) || 0,
      };

      document.addEventListener('mousemove', onDragMove, { capture: true, passive: false });
      document.addEventListener('mouseup', onDragEnd, { capture: true, passive: false });
      document.body.setAttribute('data-em-dragging', 'true');
    }

    function onDragMove(event) {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();

      const host = PanelHost.getHost();
      if (!host) return;

      const deltaX = event.clientX - startPos.x;
      const deltaY = event.clientY - startPos.y;

      const newTop = Math.max(8, startOffset.top + deltaY);
      const newRight = Math.max(8, startOffset.right - deltaX);

      host.style.top = `${newTop}px`;
      host.style.right = `${newRight}px`;
    }

    function onDragEnd(event) {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();

      dragging = false;
      document.removeEventListener('mousemove', onDragMove, { capture: true });
      document.removeEventListener('mouseup', onDragEnd, { capture: true });
      document.body.removeAttribute('data-em-dragging');
    }

    function destroy() {
      if (dragging) {
        onDragEnd(new MouseEvent('mouseup'));
      }
    }

    return { init, destroy };
  })();

  // [continues in the next part...]
  // ============================================================================
  // Selector Engine - Heuristic Selector Generation
  // ============================================================================

  function findUniqueCssAttributeSelector(el, attributes) {
    const tag = el.tagName.toLowerCase();
    for (const attribute of attributes) {
      const value = el.getAttribute(attribute);
      if (!value) continue;
      const escapedValue = CSS.escape(value);
      if (attribute === 'aria-label' && el.getAttribute('role')) {
        const roleSelector = `[role="${CSS.escape(el.getAttribute('role'))}"][aria-label="${escapedValue}"]`;
        if (isDeepSelectorUnique(roleSelector, el)) return roleSelector;
      }
      const selector = `[${attribute}="${escapedValue}"]`;
      const candidate = /^(input|textarea|select)$/i.test(tag) ? `${tag}${selector}` : selector;
      if (isDeepSelectorUnique(candidate, el)) return candidate;
    }
    return '';
  }

  function findUniqueCssClassSelector(el) {
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList || []).filter((c) => /^[a-zA-Z0-9_-]+$/.test(c));
    for (const cls of classes) {
      const selector = `.${CSS.escape(cls)}`;
      if (isDeepSelectorUnique(selector, el)) return selector;
    }
    for (const cls of classes) {
      const selector = `${tag}.${CSS.escape(cls)}`;
      if (isDeepSelectorUnique(selector, el)) return selector;
    }
    return '';
  }

  function findPreferredCssSelector(el, prefs) {
    if (prefs.preferTestId) {
      const selector = findUniqueCssAttributeSelector(el, TEST_ID_ATTRIBUTES);
      if (selector) return selector;
    }
    if (prefs.preferAria) {
      const selector = findUniqueCssAttributeSelector(el, ACCESSIBLE_ATTRIBUTES);
      if (selector) return selector;
    }
    if (prefs.preferId && el.id) {
      const selector = `#${CSS.escape(el.id)}`;
      if (isDeepSelectorUnique(selector, el)) return selector;
    }
    if (prefs.preferStableAttr) {
      const selector = findUniqueCssAttributeSelector(el, STABLE_ATTRIBUTES);
      if (selector) return selector;
    }
    return prefs.preferClass ? findUniqueCssClassSelector(el) : '';
  }

  function generateSelector(el) {
    if (!(el instanceof Element)) return '';

    const prefs = StateStore.get('prefs');

    const directSelector = findPreferredCssSelector(el, prefs);
    if (directSelector) return directSelector;

    const root = el.getRootNode();
    const boundary = root instanceof ShadowRoot ? root.host : document.body;
    for (let cur = el.parentElement; cur && cur !== boundary; cur = cur.parentElement) {
      const anchor = findPreferredCssSelector(cur, prefs);
      if (!anchor) continue;
      const relative = buildPathFromAncestor(cur, el);
      const selector = relative ? `${anchor} ${relative}` : anchor;
      if (isDeepSelectorUnique(selector, el)) return selector;
    }

    return buildFullPath(el);
  }

  function buildPathFromAncestor(ancestor, target) {
    const segs = [];
    let cur = target;

    // Detect if we're inside shadow DOM
    const root = target.getRootNode();
    const isShadowElement = root instanceof ShadowRoot;
    const boundary = isShadowElement ? root.host : document.body;

    while (cur && cur !== ancestor && cur !== boundary) {
      let seg = cur.tagName.toLowerCase();
      const parent = cur.parentElement;

      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) {
          seg += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }

      segs.unshift(seg);
      cur = parent;

      // Stop if we've reached the shadow root host
      if (isShadowElement && cur === boundary) {
        break;
      }
    }

    return segs.join(' > ');
  }

  function buildFullPath(el) {
    let path = '';
    let current = el;

    // Detect if the element is inside a shadow DOM
    const root = el.getRootNode();
    const isShadowElement = root instanceof ShadowRoot;

    // Determine the boundary where we should stop traversing
    const boundary = isShadowElement ? root.host : document.body;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== boundary) {
      let sel = current.tagName.toLowerCase();
      const parent = current.parentElement;

      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
        if (siblings.length > 1) {
          sel += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }

      path = path ? `${sel} > ${path}` : sel;
      current = parent;

      // Stop if we've reached the shadow root host
      if (isShadowElement && current === boundary) {
        break;
      }
    }

    // For shadow DOM elements, don't prepend "body >"
    // The selector should be relative within the shadow tree
    if (isShadowElement) {
      return path || el.tagName.toLowerCase();
    }

    // For light DOM elements, keep the original behavior
    return path ? `body > ${path}` : 'body';
  }

  function generateXPath(el, { skipText = false } = {}) {
    if (!(el instanceof Element)) return '';
    const prefs = StateStore.get('prefs');

    if (prefs.preferTestId) {
      const selector = findUniqueAttributeXPath(el, TEST_ID_ATTRIBUTES);
      if (selector) return selector;
    }

    if (prefs.preferAria) {
      const selector = findUniqueAttributeXPath(el, ACCESSIBLE_ATTRIBUTES);
      if (selector) return selector;
    }

    if (prefs.preferText && !skipText) {
      const selector = findUniqueTextXPath(el);
      if (selector) return selector;
    }

    if (prefs.preferId && el.id) return `//*[@id=${xpathLiteral(el.id)}]`;

    if (prefs.preferStableAttr) {
      const attrXPath = findUniqueAttributeXPath(el, STABLE_ATTRIBUTES);
      if (attrXPath) return attrXPath;
    }

    if (prefs.preferClass) {
      const classXPath = findUniqueClassXPath(el);
      if (classXPath) return classXPath;
    }

    const segs = [];
    let cur = el;

    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      const tag = cur.tagName.toLowerCase();

      if (prefs.preferTestId) {
        const selector = findUniqueAttributeXPath(cur, TEST_ID_ATTRIBUTES);
        if (selector) {
          segs.unshift(selector);
          break;
        }
      }

      if (prefs.preferAria) {
        const selector = findUniqueAttributeXPath(cur, ACCESSIBLE_ATTRIBUTES);
        if (selector) {
          segs.unshift(selector);
          break;
        }
      }

      if (prefs.preferId && cur.id) {
        segs.unshift(`//*[@id=${xpathLiteral(cur.id)}]`);
        break;
      }

      if (prefs.preferStableAttr) {
        const attrXPath = findUniqueAttributeXPath(cur, STABLE_ATTRIBUTES);
        if (attrXPath) {
          segs.unshift(attrXPath);
          break;
        }
      }

      if (prefs.preferClass) {
        const classXPath = findUniqueClassXPath(cur);
        if (classXPath) {
          segs.unshift(classXPath);
          break;
        }
      }

      let i = 1;
      let sib = cur;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName.toLowerCase() === tag) i++;
      }

      segs.unshift(`${tag}[${i}]`);
      cur = cur.parentElement;
    }

    return segs[0]?.startsWith('//*') ? segs.join('/') : '//' + segs.join('/');
  }

  function xpathLiteral(value) {
    const text = String(value);
    if (!text.includes('"')) return `"${text}"`;
    if (!text.includes("'")) return `'${text}'`;
    return `concat(${text
      .split('"')
      .map((part) => `"${part}"`)
      .join(", '\"', ")})`;
  }

  function findUniqueAttributeXPath(el, attributes) {
    for (const name of attributes) {
      const value = el.getAttribute(name);
      if (!value) continue;
      const selector = `//*[@${name}=${xpathLiteral(value)}]`;
      if (evaluateXPathAll(selector).length === 1) return selector;
    }
    return '';
  }

  function findUniqueTextXPath(el) {
    const text = String(el.innerText || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || text.length > 80) return '';
    const selector = `//${el.tagName.toLowerCase()}[normalize-space(.)=${xpathLiteral(text)}]`;
    return evaluateXPathAll(selector).length === 1 ? selector : '';
  }

  function findUniqueClassXPath(el) {
    for (const className of Array.from(el.classList || [])) {
      if (!/^[a-zA-Z0-9_-]+$/.test(className)) continue;
      const selector = `//*[contains(concat(' ', normalize-space(@class), ' '), ${xpathLiteral(` ${className} `)})]`;
      if (evaluateXPathAll(selector).length === 1) return selector;
    }
    return '';
  }

  function generateListSelector(target) {
    const list = computeElementList(target);
    const selected = list?.find((item) => item === target || item.contains(target)) || target;
    const parent = selected.parentElement;

    if (!parent) return generateSelector(target);

    const parentSel = generateSelector(parent);
    if (!parentSel) return generateSelector(target);

    // The repeated container is usually a row, while the selected element is
    // a descendant such as a button or switch. Keep the row unindexed and
    // append the selected element's relative path so every row is matched.
    const relative =
      selected !== target && selected.contains(target)
        ? buildPathFromAncestor(selected, target)
        : '';
    return `${parentSel} > ${selected.tagName.toLowerCase()}${relative ? ` > ${relative}` : ''}`;
  }

  function generateListXPath(target) {
    const list = computeElementList(target);
    const selected = list?.find((item) => item === target || item.contains(target)) || target;
    const parent = selected.parentElement;
    if (!parent) return generateXPath(target);

    const parentXPath = generateXPath(parent, { skipText: true });
    if (!parentXPath) return generateXPath(target);
    const relative =
      selected !== target && selected.contains(target)
        ? buildXPathPathFromAncestor(selected, target)
        : '';
    return `${parentXPath}/${selected.tagName.toLowerCase()}${relative ? `/${relative}` : ''}`;
  }

  function buildXPathPathFromAncestor(ancestor, target) {
    const parts = [];
    let current = target;
    while (current && current !== ancestor && current.nodeType === 1) {
      const tag = current.tagName.toLowerCase();
      let index = 1;
      let sibling = current;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.tagName.toLowerCase() === tag) index += 1;
      }
      parts.unshift(`${tag}[${index}]`);
      current = current.parentElement;
    }
    return parts.join('/');
  }

  function getAccessibleName(el) {
    try {
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const label = labelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' ');
        if (label.trim()) return label.trim();
      }

      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();

      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) return (label.textContent || '').trim();
      }

      const parentLabel = el.closest('label');
      if (parentLabel) return (parentLabel.textContent || '').trim();

      const label =
        el.getAttribute('placeholder') || el.getAttribute('alt') || el.getAttribute('title');
      if (label) return label.trim();

      return /^(A|BUTTON|OPTION|SUMMARY)$/.test(el.tagName)
        ? (el.innerText || el.textContent || '').trim()
        : '';
    } catch {
      return '';
    }
  }

  function getElementName(el) {
    const inputTypes = {
      checkbox: 'checkbox',
      radio: 'radio button',
      submit: 'submit button',
      button: 'button',
    };
    const types = {
      A: 'link',
      BUTTON: 'button',
      INPUT: inputTypes[el.getAttribute('type')] || 'input',
      TEXTAREA: 'text area',
      SELECT: 'dropdown',
      IMG: 'image',
    };
    const type = types[el.tagName] || 'element';
    const label = getAccessibleName(el).replace(/\s+/g, ' ').slice(0, 40);
    const peers = Array.from(el.getRootNode().querySelectorAll(el.tagName));
    const index = Math.max(peers.indexOf(el) + 1, 1);
    return `${type} #${index}${label ? `: ${label}${label.length === 40 ? '…' : ''}` : ''}`;
  }

  // ============================================================================
  // List Mode Utilities
  // ============================================================================

  function getAllSiblings(el, selector) {
    const siblings = [el];
    const validate = (element) => {
      const isSameTag = el.tagName === element.tagName;
      let ok = isSameTag;
      if (selector) {
        try {
          ok = ok && !!element.querySelector(selector);
        } catch {}
      }
      return ok;
    };

    let next = el;
    let prev = el;
    let elementIndex = 1;

    while ((prev = prev?.previousElementSibling)) {
      if (validate(prev)) {
        elementIndex += 1;
        siblings.unshift(prev);
      }
    }

    while ((next = next?.nextElementSibling)) {
      if (validate(next)) siblings.push(next);
    }

    return { elements: siblings, index: elementIndex };
  }

  function getElementList(el, maxDepth = 50, paths = []) {
    if (maxDepth === 0 || !el || el.tagName === 'BODY') return null;

    let selector = el.tagName.toLowerCase();
    const { elements, index } = getAllSiblings(el, paths.join(' > '));
    let siblings = elements;

    if (index !== 1) selector += `:nth-of-type(${index})`;
    paths.unshift(selector);

    if (siblings.length === 1) {
      siblings = getElementList(el.parentElement, maxDepth - 1, paths);
    }

    return siblings;
  }

  function computeElementList(target) {
    try {
      return getElementList(target) || [target];
    } catch {
      return [target];
    }
  }

  // List mode groups repeated containers (for example table rows), while the
  // user usually selected a descendant inside that container. Resolve the
  // same descendant in every repeated container for preview and execution.
  function resolveListTargets(target, containers = null) {
    if (!(target instanceof Element)) return [];

    const list =
      Array.isArray(containers) && containers.length ? containers : computeElementList(target);
    if (!Array.isArray(list) || list.length === 0) return [target];

    const container = list.find((item) => item === target || item.contains(target));
    if (!(container instanceof Element) || !container.contains(target) || container === target) {
      return list.filter((item) => item instanceof Element);
    }

    const relative = buildPathFromAncestor(container, target);
    if (!relative) return [target];

    const resolved = list
      .map((item) => {
        try {
          return item instanceof Element ? item.querySelector(relative) : null;
        } catch {
          return null;
        }
      })
      .filter((item) => item instanceof Element);

    return resolved.length === list.length ? resolved : [target];
  }

  // ============================================================================
  // Deep Query (Shadow DOM Support)
  // ============================================================================

  function* walkAllNodesDeep(root) {
    const stack = [root];
    let count = 0;
    const MAX = 10000;

    while (stack.length) {
      const node = stack.pop();
      if (!node || ++count > MAX) continue;

      // Skip overlay elements to prevent panel self-highlighting
      if (isOverlayElement(node)) {
        continue;
      }

      yield node;

      try {
        if (node.children) {
          const children = Array.from(node.children);
          for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
          }
        }

        if (node.shadowRoot?.children) {
          const srChildren = Array.from(node.shadowRoot.children);
          for (let i = srChildren.length - 1; i >= 0; i--) {
            stack.push(srChildren[i]);
          }
        }
      } catch {}
    }
  }

  function queryAllDeep(selector) {
    const results = [];
    for (const node of walkAllNodesDeep(document)) {
      if (!(node instanceof Element)) continue;
      try {
        if (node.matches(selector)) results.push(node);
      } catch {}
    }
    return results;
  }

  /**
   * Check if a selector uniquely identifies the target element across the entire DOM tree,
   * including shadow DOM boundaries.
   *
   * This function uses queryAllDeep to traverse both light DOM and shadow DOM,
   * ensuring that selectors work correctly for elements inside shadow roots.
   *
   * @param {string} selector - The CSS selector to test
   * @param {Element} target - The target element that should be uniquely identified
   * @returns {boolean} True if the selector matches exactly one element and it's the target
   */
  function isDeepSelectorUnique(selector, target) {
    if (!selector || !(target instanceof Element)) return false;
    try {
      const matches = queryAllDeep(selector);
      return matches.length === 1 && matches[0] === target;
    } catch (error) {
      return false;
    }
  }

  function evaluateXPathAll(xpath) {
    try {
      const arr = [];
      const res = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );

      for (let i = 0; i < res.snapshotLength; i++) {
        const n = res.snapshotItem(i);
        // Filter out overlay elements to prevent panel self-highlighting
        if (n?.nodeType === 1 && !isOverlayElement(n)) {
          arr.push(n);
        }
      }
      return arr;
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Highlighter & Rects Management
  // ============================================================================

  const STATE = {
    active: false,
    hoverEl: null,
    selectedEl: null,
    selectedElements: [],
    remoteSelectedMembers: [],
    memberNames: new Map(),
    similarScope: 'region',
    previewElements: [],
    pendingMemberQueries: new Map(),
    repairTarget: null,
    extractionRows: [],
    selectionMode: null,
    box: null,
    highlighter: null,
    listenersAttached: false,
    rectsHost: null,
    hoveredList: [],
    verifyRectsActive: false, // Track if verify rects are showing
    // Performance optimization: rAF throttling for hover
    hoverRafId: null,
    lastHoverTarget: null,
    // DOM pooling for rect elements
    rectPool: [],
    rectPoolUsed: 0,
    nameElement: null,
    boxSelectionStart: null,
    boxSelectionOverlay: null,
    suppressClick: false,
    replayingClick: false,
  };

  function clearBoxSelectionOverlay() {
    STATE.boxSelectionOverlay?.remove();
    STATE.boxSelectionOverlay = null;
  }

  function drawBoxSelection(rect) {
    const box = STATE.boxSelectionOverlay || document.createElement('div');
    if (!STATE.boxSelectionOverlay) {
      box.id = '__element_marker_box_selection';
      Object.assign(box.style, {
        position: 'fixed',
        zIndex: String(CONFIG.Z_INDEX.HIGHLIGHTER),
        pointerEvents: 'none',
        border: `2px dashed ${CONFIG.COLORS.PRIMARY}`,
        background: `${CONFIG.COLORS.PRIMARY}1a`,
        borderRadius: '4px',
      });
      document.documentElement.appendChild(box);
      STATE.boxSelectionOverlay = box;
    }
    Object.assign(box.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  function ensureHighlighter() {
    if (STATE.highlighter) return STATE.highlighter;

    const hl = document.createElement('div');
    hl.id = '__element_marker_highlight';
    Object.assign(hl.style, {
      position: 'fixed',
      zIndex: String(CONFIG.Z_INDEX.HIGHLIGHTER),
      pointerEvents: 'none',
      border: `2px solid ${CONFIG.COLORS.HOVER}`,
      borderRadius: '4px',
      boxShadow: `0 0 0 2px ${CONFIG.COLORS.HOVER}33`,
      transition: 'all 100ms ease-out',
    });

    document.documentElement.appendChild(hl);
    STATE.highlighter = hl;
    return hl;
  }

  function ensureRectsHost() {
    if (STATE.rectsHost) return STATE.rectsHost;

    const host = document.createElement('div');
    host.id = '__element_marker_rects';
    Object.assign(host.style, {
      position: 'fixed',
      zIndex: String(CONFIG.Z_INDEX.RECTS),
      pointerEvents: 'none',
      inset: '0',
    });

    document.documentElement.appendChild(host);
    STATE.rectsHost = host;
    return host;
  }

  function moveHighlighterTo(el) {
    const hl = ensureHighlighter();
    const r = el.getBoundingClientRect();
    hl.style.left = `${r.left}px`;
    hl.style.top = `${r.top}px`;
    hl.style.width = `${r.width}px`;
    hl.style.height = `${r.height}px`;
    hl.style.display = 'block';
  }

  function clearHighlighter() {
    if (STATE.highlighter) STATE.highlighter.style.display = 'none';
    // Only clear hover rects, not verify rects
    if (!STATE.verifyRectsActive) {
      if (STATE.selectionMode === 'manual' && STATE.selectedElements.length > 1) {
        drawRects(STATE.selectedElements, CONFIG.COLORS.PRIMARY, false);
      } else {
        clearRects();
      }
    }
  }

  function clearRects() {
    // Hide all pooled rect boxes instead of destroying them
    const used = STATE.rectPoolUsed || 0;
    for (let i = 0; i < used; i++) {
      const box = STATE.rectPool[i];
      if (box) box.style.display = 'none';
    }
    STATE.rectPoolUsed = 0;
    STATE.verifyRectsActive = false;
    // Invalidate lastHoverTarget so next hover will redraw even on same element
    STATE.lastHoverTarget = null;
  }

  /**
   * Get or create a rect box from the pool
   * @param {HTMLElement} host - The container element
   * @param {number} index - The pool index
   * @returns {HTMLDivElement} The rect box element
   */
  function getOrCreateRectBox(host, index) {
    let box = STATE.rectPool[index];
    if (!box) {
      box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed',
        pointerEvents: 'none',
        borderRadius: '4px',
        transition: 'all 100ms ease-out',
        display: 'none',
      });
      STATE.rectPool[index] = box;
    }
    // Ensure the box is attached to the host
    if (!box.isConnected) {
      host.appendChild(box);
    }
    return box;
  }

  // Maximum rect pool size to prevent memory bloat
  const MAX_RECT_POOL_SIZE = 100;

  /**
   * Draw rect boxes with pooling optimization
   * @param {Array<{x: number, y: number, width: number, height: number}>} rects - Rect data
   * @param {Object} options - Drawing options
   * @param {boolean} options.isVerify - Whether this is a verify highlight (affects verifyRectsActive)
   */
  function drawRectBoxes(
    rects,
    { color = CONFIG.COLORS.HOVER, dashed = true, offsetX = 0, offsetY = 0, isVerify = false } = {},
  ) {
    const host = ensureRectsHost();
    const prevUsed = STATE.rectPoolUsed || 0;
    // Limit rect count to prevent memory bloat
    const count = Math.min(Array.isArray(rects) ? rects.length : 0, MAX_RECT_POOL_SIZE);

    // Update or show rect boxes
    for (let i = 0; i < count; i++) {
      const r = rects[i];
      if (!r) continue;

      const x = Number.isFinite(r.left) ? r.left : Number.isFinite(r.x) ? r.x : 0;
      const y = Number.isFinite(r.top) ? r.top : Number.isFinite(r.y) ? r.y : 0;
      const w = Number.isFinite(r.width) ? r.width : 0;
      const h = Number.isFinite(r.height) ? r.height : 0;

      const box = getOrCreateRectBox(host, i);
      Object.assign(box.style, {
        left: `${offsetX + x}px`,
        top: `${offsetY + y}px`,
        width: `${w}px`,
        height: `${h}px`,
        border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        boxShadow: `0 0 0 2px ${color}22`,
        display: 'block',
      });
    }

    // Hide excess boxes from previous render
    for (let i = count; i < prevUsed; i++) {
      const box = STATE.rectPool[i];
      if (box) box.style.display = 'none';
    }

    STATE.rectPoolUsed = count;
    // Reset verifyRectsActive for hover operations (so clearHighlighter works correctly)
    // Only set to true when isVerify is explicitly true
    STATE.verifyRectsActive = isVerify;
  }

  function drawRects(elements, color = CONFIG.COLORS.HOVER, dashed = true, isVerify = false) {
    const rects = elements.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    drawRectBoxes(rects, { color, dashed, isVerify });
  }

  // ============================================================================
  // Interaction Logic
  // ============================================================================

  function isInsidePanel(target) {
    const shadow = PanelHost.getShadow();
    return !!shadow && target instanceof Node && shadow.contains(target);
  }

  /**
   * Other page pickers also listen for clicks while collecting element info.
   * Their listener may be registered on document, after this script's window
   * capture listener. Do not consume the event when one of them is active.
   */
  function isExternalPickerActive() {
    return Boolean(
      document.getElementById('__rr_picker_host__') ||
      document.getElementById('__mcp_element_picker_host__'),
    );
  }

  /**
   * Check if a node belongs to the element marker overlay (panel host or its shadow DOM)
   * This is used to filter out overlay elements from query results to prevent self-highlighting
   *
   * @param {Node} node - The node to check
   * @returns {boolean} True if the node is part of the overlay
   */
  function isOverlayElement(node) {
    if (!(node instanceof Node)) return false;

    const host = PanelHost.getHost();
    if (!host) return false;

    // Check if node is the panel host itself
    if (node === host) return true;

    // Check if node is within the shadow DOM of the panel host
    const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
    return root instanceof ShadowRoot && root.host === host;
  }

  /**
   * Filter out overlay elements from an array of elements
   * This ensures that panel components are never included in highlight/verification results
   *
   * @param {Array} elements - Array of elements to filter
   * @returns {Array} Filtered array without overlay elements
   */
  function filterOverlayElements(elements) {
    if (!Array.isArray(elements)) return [];
    return elements.filter((node) => !isOverlayElement(node));
  }

  /**
   * Get the effective event target for page element selection, considering shadow DOM boundaries.
   *
   * This function resolves the real target element from a pointer event by walking the
   * composed path (if available) to find the innermost page element, skipping overlay elements.
   *
   * Background:
   * - When events bubble up from inside shadow DOM, they get "retargeted" at shadow boundaries
   * - By the time a window-level listener receives the event, ev.target points to the shadow host
   * - composedPath() exposes the original event path before retargeting
   * - This allows us to select elements inside shadow DOM (e.g., <td-header> internals)
   *
   * IMPORTANT: This function should only be called AFTER verifying the event is not from
   * overlay UI (panel buttons, etc). Otherwise it will filter out overlay elements and break
   * panel interactions.
   *
   * @param {Event} ev - The pointer event (mousemove, click, etc.)
   * @returns {Element|null} The innermost non-overlay page element, or null if none found
   */
  function getDeepPageTarget(ev) {
    if (!ev) return null;

    // Try to walk the composed path to find the innermost non-overlay element
    try {
      const path = typeof ev.composedPath === 'function' ? ev.composedPath() : null;
      if (Array.isArray(path) && path.length > 0) {
        // Walk from innermost to outermost, find the first real page element
        for (const node of path) {
          if (node instanceof Element && !isOverlayElement(node)) {
            return node;
          }
        }
      }
    } catch (error) {
      // composedPath() may throw in some edge cases (e.g., detached nodes)
      // Fall through to use ev.target
    }

    // Fallback: use ev.target if composedPath is unavailable or all nodes were filtered
    const fallback = ev.target instanceof Element ? ev.target : null;
    // If fallback is overlay, return null (caller should handle this case)
    if (fallback && !isOverlayElement(fallback)) {
      return fallback;
    }
    return null;
  }

  // Store pending hover event for rAF processing
  let pendingHoverEvent = null;

  /**
   * Process mouse move event - the actual hover update logic
   * Separated from onMouseMove for rAF throttling
   */
  function processMouseMove(ev) {
    if (!STATE.active || STATE.boxSelectionStart) return;

    if (isExternalPickerActive()) {
      STATE.hoverEl = null;
      STATE.lastHoverTarget = null;
      clearHighlighter();
      return;
    }

    const rawTarget = ev?.target;
    if (!(rawTarget instanceof Element)) {
      STATE.hoverEl = null;
      STATE.lastHoverTarget = null;
      clearHighlighter();
      return;
    }

    const host = PanelHost.getHost();
    if ((host && rawTarget === host) || isInsidePanel(rawTarget)) {
      STATE.hoverEl = null;
      STATE.lastHoverTarget = null;
      clearHighlighter();
      return;
    }

    const target = getDeepPageTarget(ev) || rawTarget;
    STATE.hoverEl = target;

    const previewing = !!ev?.shiftKey;

    // Get current listMode
    let listMode = false;
    try {
      listMode = !!StateStore.get('listMode') && STATE.selectionMode !== 'manual';
    } catch {}

    // Skip update if target and mode haven't changed
    const last = STATE.lastHoverTarget;
    if (
      last &&
      last.element === target &&
      last.listMode === listMode &&
      last.previewing === previewing &&
      last.scope === STATE.similarScope
    ) {
      return;
    }
    STATE.lastHoverTarget = { element: target, listMode, previewing, scope: STATE.similarScope };

    if (previewing) {
      STATE.previewElements = resolveSimilarTargets(target);
      const rects = STATE.previewElements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      });
      if (!IS_MAIN) {
        window.parent.postMessage(
          {
            type: 'em_hover',
            rects,
            preview: true,
            previewCount: STATE.previewElements.length,
            scope: STATE.similarScope,
          },
          '*',
        );
      } else {
        drawRects(STATE.previewElements, CONFIG.COLORS.HOVER, true);
        const status = STATE.box?.querySelector('#__em_similar_preview_status');
        if (status) {
          const scope = STATE.similarScope === 'page' ? 'current page' : 'current region';
          status.textContent = `Shift click will select ${STATE.previewElements.length} item(s) (${scope})`;
        }
      }
      return;
    }

    STATE.previewElements = [];
    if (IS_MAIN) {
      const status = STATE.box?.querySelector('#__em_similar_preview_status');
      if (status) status.textContent = '';
    }

    if (!IS_MAIN) {
      try {
        const list = listMode ? resolveListTargets(target) : [target];
        const rects = list.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left, y: r.top, width: r.width, height: r.height };
        });

        // Performance: Don't generate selector on hover (defer to click)
        window.parent.postMessage({ type: 'em_hover', rects }, '*');
      } catch {}
      return;
    }

    if (listMode) {
      STATE.hoveredList = resolveListTargets(target);
      drawRects(STATE.hoveredList);
    } else {
      moveHighlighterTo(target);
    }
  }

  /**
   * Mouse move handler with rAF throttling
   * Ensures hover updates are batched to animation frame rate
   */
  function onMouseMove(ev) {
    if (!STATE.active || STATE.boxSelectionStart) return;

    // Store the latest event
    pendingHoverEvent = ev;

    // Skip if already scheduled
    if (STATE.hoverRafId != null) return;

    // Schedule processing on next animation frame
    STATE.hoverRafId = requestAnimationFrame(() => {
      STATE.hoverRafId = null;
      const latest = pendingHoverEvent;
      pendingHoverEvent = null;
      if (!latest) return;
      processMouseMove(latest);
    });
  }

  // ============================================================================
  // Event Listeners Management
  // ============================================================================

  function attachPointerListeners() {
    if (STATE.listenersAttached) return;
    window.addEventListener('mousedown', onBoxSelectionStart, true);
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    STATE.listenersAttached = true;
  }

  function detachPointerListeners() {
    if (!STATE.listenersAttached) return;
    window.removeEventListener('mousedown', onBoxSelectionStart, true);
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('click', onClick, true);
    STATE.listenersAttached = false;
  }

  function attachKeyboardListener() {
    window.addEventListener('keydown', onKeyDown, true);
  }

  function detachKeyboardListener() {
    window.removeEventListener('keydown', onKeyDown, true);
  }

  function syncInteractionMode() {
    if (!STATE.active) return;
    const activeTab = StateStore.get('activeTab');
    if (activeTab === 'execute') {
      StateStore.set({ boxSelect: false });
      // In execute mode, detach pointer listeners to allow real interactions
      // but keep keyboard listener for Esc key
      detachPointerListeners();
      // Only clear the hover highlighter, not the verification rects
      if (STATE.highlighter) STATE.highlighter.style.display = 'none';
    } else {
      // In attributes mode, attach all listeners for element selection
      attachPointerListeners();
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Re-run the page click after the marker has captured the element.
   *
   * The marker intentionally consumes the user's native click so links and
   * buttons do not fire while selecting. A second, tagged click preserves the
   * site's own delegated handlers (dropdowns, dialogs, etc.) without making the
   * marker select the same element again.
   */
  function replayPageClick(target, sourceEvent) {
    if (!(target instanceof Element) || STATE.replayingClick || isOverlayElement(target)) return;

    STATE.replayingClick = true;
    try {
      const replay = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        detail: Number(sourceEvent?.detail) || 1,
        screenX: Number(sourceEvent?.screenX) || 0,
        screenY: Number(sourceEvent?.screenY) || 0,
        clientX: Number(sourceEvent?.clientX) || 0,
        clientY: Number(sourceEvent?.clientY) || 0,
        ctrlKey: !!sourceEvent?.ctrlKey,
        altKey: !!sourceEvent?.altKey,
        shiftKey: !!sourceEvent?.shiftKey,
        metaKey: !!sourceEvent?.metaKey,
      });
      Object.defineProperty(replay, '__elementMarkerReplay', { value: true });
      target.dispatchEvent(replay);
    } catch (error) {
      // Some host objects do not accept a constructed MouseEvent; fall back to
      // the native HTMLElement.click() path while the guard is still active.
      try {
        target.click?.();
      } catch {}
    } finally {
      STATE.replayingClick = false;
    }
  }

  function selectTarget(target, modifiers = {}) {
    if (modifiers.ctrlKey || modifiers.metaKey) {
      const selected = STATE.selectedElements.filter((element) => element.isConnected);
      const next = selected.includes(target)
        ? selected.filter((element) => element !== target)
        : [...selected, target];
      StateStore.set({ listMode: next.length > 1 });
      return setSelection(next.at(-1) || null, next, 'manual');
    } else if (modifiers.shiftKey) {
      const selected = STATE.selectedElements.filter((element) => element.isConnected);
      const similar = resolveSimilarTargets(target);
      const next = [...new Set([...selected, ...similar])];
      StateStore.set({ listMode: true });
      return setSelection(target, next, 'manual');
    } else {
      if (STATE.selectionMode === 'manual') StateStore.set({ listMode: false });
      if (IS_MAIN) STATE.remoteSelectedMembers = [];
      return setSelection(target);
    }
  }

  function createMemberId() {
    return (
      globalThis.crypto?.randomUUID?.() ||
      `member_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
  }

  function getLocalMemberKey(member) {
    return JSON.stringify([member.framePath || [], member.selectorType || 'css', member.selector]);
  }

  function getLocalSelectedMembers() {
    const elements =
      STATE.selectionMode === 'manual' && STATE.selectedElements.length
        ? STATE.selectedElements
        : STATE.selectedEl
          ? [STATE.selectedEl]
          : [];
    const selectorType = StateStore.get('selectorType');
    return elements.map((element) => {
      const member = {
        id: createMemberId(),
        name: getElementName(element),
        selector: selectorType === 'xpath' ? generateXPath(element) : generateSelector(element),
        selectorType,
        tagName: element.tagName.toLowerCase(),
      };
      member.key = getLocalMemberKey(member);
      return member;
    });
  }

  function getSelectedMarkerMembers() {
    const local = getLocalSelectedMembers();
    const all = [...local, ...STATE.remoteSelectedMembers];
    const seen = new Set();
    return all
      .filter((member) => {
        const key = getLocalMemberKey(member);
        if (!member.selector || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((member) => ({
        id: member.id || createMemberId(),
        name: STATE.memberNames.get(getLocalMemberKey(member)) || member.name || member.selector,
        selector: member.selector,
        selectorType: member.selectorType || 'css',
        ...(member.framePath?.length ? { framePath: member.framePath } : {}),
        ...(member.tagName ? { tagName: member.tagName } : {}),
      }));
  }

  function reportFrameSelection(target, selector, modifiers = {}) {
    const isManual = !!(modifiers.ctrlKey || modifiers.metaKey || modifiers.shiftKey);
    const members = isManual
      ? STATE.selectedElements.map((element) => ({
          id: createMemberId(),
          name: getElementName(element),
          selector:
            StateStore.get('selectorType') === 'xpath'
              ? generateXPath(element)
              : generateSelector(element),
          selectorType: StateStore.get('selectorType'),
          tagName: element.tagName.toLowerCase(),
        }))
      : [
          {
            id: createMemberId(),
            name: getElementName(target),
            selector,
            selectorType: StateStore.get('selectorType'),
            tagName: target.tagName.toLowerCase(),
          },
        ];
    window.parent.postMessage(
      {
        type: 'em_selection_update',
        selectionMode: isManual ? 'manual' : 'single',
        members,
      },
      '*',
    );
  }

  function postToChildFrames(message) {
    for (const frame of Array.from(document.querySelectorAll('iframe, frame'))) {
      try {
        frame.contentWindow?.postMessage(message, '*');
      } catch {}
    }
  }

  function resolveSimilarTargets(target, scope = STATE.similarScope) {
    const all = resolveListTargets(target).slice(0, 100);
    if (scope === 'page') return all;
    const region = target.closest(
      'table, ul, ol, [role="list"], [role="listbox"], [role="grid"], main, article, form, fieldset',
    );
    if (!region) return all;
    const withinRegion = all.filter((element) => region.contains(element));
    return withinRegion.includes(target) ? withinRegion : [target];
  }

  function buildCompositeMemberSelector(member) {
    return [...(member.framePath || [])]
      .reverse()
      .reduce((selector, segment) => `${segment.selector} |> ${selector}`, member.selector);
  }

  async function locateMember(member) {
    const result = await highlightSelectorExternal({
      selector: buildCompositeMemberSelector(member),
      selectorType: member.selectorType || 'css',
    });
    if (!result?.success) {
      StateStore.set({
        validation: { status: 'failure', message: result?.error || 'Cannot locate this element' },
      });
    }
    return result;
  }

  function receiveFrameSelection(data, framePath) {
    const frameKey = JSON.stringify(framePath);
    const incoming = (Array.isArray(data.members) ? data.members : []).map((member) => {
      const frameMember = { ...member, framePath };
      const key = getLocalMemberKey(frameMember);
      const existing = STATE.remoteSelectedMembers.find((item) => getLocalMemberKey(item) === key);
      return { ...frameMember, id: existing?.id || createMemberId(), key };
    });

    if (data.selectionMode !== 'manual') {
      STATE.selectedElements = [];
      STATE.selectedEl = null;
      STATE.remoteSelectedMembers = incoming;
    } else {
      STATE.remoteSelectedMembers = STATE.remoteSelectedMembers.filter(
        (member) => JSON.stringify(member.framePath) !== frameKey,
      );
      STATE.remoteSelectedMembers.push(...incoming);
    }
    STATE.selectionMode =
      data.selectionMode === 'manual' || STATE.remoteSelectedMembers.length ? 'manual' : null;
    const last = incoming.at(-1);
    const selector = last ? buildCompositeMemberSelector(last) : '';
    const selectorText = STATE.box?.querySelector('#__em_selector');
    const selectorDisplay = STATE.box?.querySelector('#__em_selector_text');
    const inputName = STATE.box?.querySelector('#__em_name');
    if (selectorText) selectorText.textContent = selector || '-';
    if (selectorDisplay) selectorDisplay.textContent = selector || 'Click a page element to mark';
    if (inputName && last) inputName.value = last.name || 'Element';
    StateStore.set({ listMode: STATE.remoteSelectedMembers.length > 1 });
    renderSelectionList();
    return incoming;
  }

  async function completeMarkerRepair(member) {
    const repair = STATE.repairTarget;
    if (!repair || !member?.selector) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'element_marker_update_member',
        markerId: repair.markerId,
        memberId: repair.memberId,
        locator: {
          selector: member.selector,
          selectorType: member.selectorType || 'css',
          framePath: member.framePath || [],
          tagName: member.tagName,
        },
      });
      StateStore.set({
        validation: response?.success
          ? { status: 'success', message: `✓ Updated locator for "${member.name || 'element'}"` }
          : { status: 'failure', message: response?.error || 'Failed to update locator' },
      });
      if (response?.success) STATE.repairTarget = null;
    } catch (error) {
      StateStore.set({
        validation: { status: 'failure', message: error?.message || 'Failed to update locator' },
      });
    }
  }

  function renderSelectionList() {
    const host = STATE.box;
    const list = host?.querySelector('#__em_selection_list');
    const count = host?.querySelector('#__em_selection_count');
    const items = host?.querySelector('#__em_selection_items');
    const saveButton = host?.querySelector('#__em_save');
    const saveSeparateButton = host?.querySelector('#__em_save_separate');
    const nameLabel = host?.querySelector('#__em_name_label');
    const nameInput = host?.querySelector('#__em_name');
    const previewStatus = host?.querySelector('#__em_similar_preview_status');
    const extractControls = host?.querySelector('#__em_extract_controls');
    const extractResult = host?.querySelector('#__em_extract_result');
    const copyExtract = host?.querySelector('#__em_copy_extract');
    const downloadExtract = host?.querySelector('#__em_download_extract');
    if (!list || !count || !items) return;

    const selectedMembers = getSelectedMarkerMembers();
    const isManualSelection = STATE.selectionMode === 'manual' && selectedMembers.length > 0;
    list.hidden = !isManualSelection;
    if (extractControls) extractControls.hidden = selectedMembers.length === 0;
    if (extractResult) extractResult.hidden = true;
    if (copyExtract) copyExtract.hidden = true;
    if (downloadExtract) downloadExtract.hidden = true;
    STATE.extractionRows = [];
    items.replaceChildren();

    if (!isManualSelection) {
      if (saveButton) saveButton.textContent = 'Save marker';
      if (saveSeparateButton) saveSeparateButton.hidden = true;
      if (nameLabel) nameLabel.textContent = 'Name';
      if (nameInput) nameInput.placeholder = 'Element name';
      if (previewStatus) previewStatus.textContent = '';
      if (extractResult) extractResult.hidden = true;
      return;
    }

    count.textContent = `${selectedMembers.length} item(s) selected`;
    if (saveSeparateButton) saveSeparateButton.hidden = selectedMembers.length < 2;
    for (const member of selectedMembers) {
      const row = document.createElement('div');
      row.className = 'em-selection-item';
      row.dataset.memberKey = getLocalMemberKey(member);

      const memberContent = document.createElement('div');
      memberContent.className = 'em-selection-member';

      const nameInput = document.createElement('input');
      nameInput.className = 'em-selection-name-input';
      nameInput.value = STATE.memberNames.get(getLocalMemberKey(member)) || member.name;
      nameInput.title = member.framePath?.length
        ? `iframe: ${member.framePath.map((segment) => segment.selector).join(' → ')}`
        : member.tagName || 'Current page';
      nameInput.setAttribute('aria-label', `Element name: ${member.name}`);
      nameInput.addEventListener('input', () => {
        STATE.memberNames.set(getLocalMemberKey(member), nameInput.value.trim());
      });
      memberContent.append(nameInput);

      const locate = document.createElement('button');
      locate.className = 'em-selection-remove';
      locate.type = 'button';
      locate.textContent = 'Locate';
      locate.setAttribute('aria-label', `Locate ${member.name}`);
      locate.addEventListener('click', () => locateMember(member));

      const remove = document.createElement('button');
      remove.className = 'em-selection-remove';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${member.name}`);
      remove.addEventListener('click', () => removeSelectedMember(member));

      row.append(memberContent, locate, remove);
      items.append(row);
    }

    if (saveButton) saveButton.textContent = `Save group (${selectedMembers.length} item(s))`;
    if (nameLabel) nameLabel.textContent = 'Group name';
    if (nameInput) nameInput.placeholder = 'Name this group of elements';
  }

  function removeSelectedMember(member) {
    const key = getLocalMemberKey(member);
    STATE.memberNames.delete(key);
    if (member.framePath?.length) {
      STATE.remoteSelectedMembers = STATE.remoteSelectedMembers.filter(
        (item) => getLocalMemberKey(item) !== key,
      );
    } else {
      STATE.selectedElements = STATE.selectedElements.filter((element) => {
        const selector =
          member.selectorType === 'xpath' ? generateXPath(element) : generateSelector(element);
        return selector !== member.selector;
      });
      STATE.selectedEl = STATE.selectedElements.at(-1) || null;
    }
    StateStore.set({
      listMode: STATE.selectedElements.length + STATE.remoteSelectedMembers.length > 1,
    });
    if (STATE.selectedElements.length === 0 && STATE.remoteSelectedMembers.length === 0) {
      STATE.selectionMode = null;
      setSelection(null, [], 'manual');
    } else {
      STATE.selectionMode = 'manual';
      if (STATE.selectedEl) {
        setSelection(STATE.selectedEl, STATE.selectedElements, 'manual');
      } else {
        const firstRemote = STATE.remoteSelectedMembers[0];
        const selectorText = STATE.box?.querySelector('#__em_selector');
        const selectorDisplay = STATE.box?.querySelector('#__em_selector_text');
        if (firstRemote) {
          const selector = buildCompositeMemberSelector(firstRemote);
          if (selectorText) selectorText.textContent = selector;
          if (selectorDisplay) selectorDisplay.textContent = selector;
        }
        renderSelectionList();
      }
    }
  }

  function removeSelectedElement(element) {
    const next = STATE.selectedElements.filter((item) => item !== element && item.isConnected);
    StateStore.set({ listMode: next.length > 1 });
    setSelection(next.at(-1) || null, next, 'manual');
  }

  function clearSelectedElements() {
    STATE.remoteSelectedMembers = [];
    STATE.memberNames.clear();
    StateStore.set({ listMode: false });
    setSelection(null, [], 'manual');
  }

  async function extractSelectedMembers() {
    const members = getSelectedMarkerMembers().slice(0, 100);
    if (!members.length) return;
    const valueType = STATE.box?.querySelector('#__em_extract_type')?.value || 'text';
    const extractButton = STATE.box?.querySelector('#__em_extract_selected');
    if (extractButton) {
      extractButton.disabled = true;
      extractButton.textContent = 'Extracting...';
    }
    try {
      STATE.extractionRows = await Promise.all(
        members.map(async (member) => {
          const result = await runMemberOperation(member, 'value', valueType);
          return {
            name: member.name,
            frame:
              member.framePath?.map((segment) => segment.selector).join(' → ') || 'Current page',
            value: result?.success ? result.value : '',
            error: result?.success ? '' : result?.error || 'Read failed',
          };
        }),
      );
      const preview = STATE.box?.querySelector('#__em_extract_result');
      if (preview) {
        preview.textContent = [
          'Name\tPage/Frame\tResult',
          ...STATE.extractionRows.map(
            (row) => `${row.name}\t${row.frame}\t${row.value || row.error}`,
          ),
        ].join('\n');
        preview.hidden = false;
      }
      const copyButton = STATE.box?.querySelector('#__em_copy_extract');
      const downloadButton = STATE.box?.querySelector('#__em_download_extract');
      if (copyButton) copyButton.hidden = false;
      if (downloadButton) downloadButton.hidden = false;
    } catch (error) {
      StateStore.set({
        validation: { status: 'failure', message: error?.message || 'Batch extraction failed' },
      });
    } finally {
      if (extractButton) {
        extractButton.disabled = false;
        extractButton.textContent = 'Extract';
      }
    }
  }

  function escapeCsvField(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  async function copyExtractionRows() {
    if (!STATE.extractionRows.length) return;
    const tsv = [
      ['Name', 'Page/Frame', 'Result'],
      ...STATE.extractionRows.map((row) => [row.name, row.frame, row.error || row.value]),
    ]
      .map((row) => row.map(escapeCsvField).join('\t'))
      .join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      StateStore.set({ validation: { status: 'success', message: '✓ Copied as table' } });
    } catch {
      StateStore.set({ validation: { status: 'failure', message: 'Copy failed, use CSV export' } });
    }
  }

  function downloadExtractionCsv() {
    if (!STATE.extractionRows.length) return;
    const csv = [
      ['Name', 'Page/Frame', 'Result'],
      ...STATE.extractionRows.map((row) => [row.name, row.frame, row.error || row.value]),
    ]
      .map((row) => row.map(escapeCsvField).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'element-marker-data.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function syncSimilarScope() {
    const scope =
      STATE.box?.querySelector('#__em_selection_scope')?.value === 'page' ? 'page' : 'region';
    STATE.similarScope = scope;
    postToChildFrames({ type: 'em-similar-scope', scope });
    STATE.lastHoverTarget = null;
  }

  function onClick(ev) {
    if (!STATE.active) return;

    if (ev?.__elementMarkerReplay || STATE.replayingClick) return;

    // Validation clicks are generated by the extension and must reach the
    // page's own handlers/default actions. Only user selection clicks remain
    // consumed by the marker.
    if (ev?.__elementMarkerValidation || window.__elementMarkerValidationBypass) return;

    // If another picker owns the page, let its listener receive the native click.
    if (isExternalPickerActive()) return;

    if (STATE.suppressClick) {
      ev.preventDefault();
      ev.stopPropagation();
      STATE.suppressClick = false;
      return;
    }

    // First, use the raw ev.target to check for overlay UI
    // This ensures panel buttons and other UI elements remain interactive
    const rawTarget = ev.target;
    const host = PanelHost.getHost();

    // Check if raw target is the panel host itself or inside the shadow DOM
    // IMPORTANT: Return early WITHOUT preventDefault to allow overlay button clicks
    if ((host && rawTarget === host) || isInsidePanel(rawTarget)) {
      return;
    }

    // Now we know it's a page element, prevent default and get deep target
    ev.preventDefault();
    ev.stopPropagation();

    if (!(rawTarget instanceof Element)) return;

    // Get the deep target (considering shadow DOM) after confirming it's not overlay
    const target = getDeepPageTarget(ev) || rawTarget;

    if (!IS_MAIN) {
      try {
        const sel = selectTarget(target, ev);
        reportFrameSelection(target, sel, ev);
        if (StateStore.get('replaySiteClick')) replayPageClick(target, ev);
      } catch {}
      return;
    }

    selectTarget(target, ev);
    if (IS_MAIN && STATE.repairTarget) {
      const selectorType = StateStore.get('selectorType');
      completeMarkerRepair({
        name: getElementName(target),
        selector: selectorType === 'xpath' ? generateXPath(target) : generateSelector(target),
        selectorType,
        tagName: target.tagName.toLowerCase(),
      });
    }
    if (StateStore.get('replaySiteClick')) replayPageClick(target, ev);
  }

  function getBoxSelectionRect(start, event) {
    const left = Math.min(start.x, event.clientX);
    const top = Math.min(start.y, event.clientY);
    return {
      left,
      top,
      width: Math.abs(event.clientX - start.x),
      height: Math.abs(event.clientY - start.y),
    };
  }

  function findBoxSelectionTarget(rect) {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const candidates = document.elementsFromPoint(x, y).filter((el) => !isOverlayElement(el));

    let target = null;
    let smallestArea = Infinity;
    for (const el of candidates) {
      const bounds = el.getBoundingClientRect();
      const containsBox =
        bounds.left <= rect.left &&
        bounds.top <= rect.top &&
        bounds.right >= rect.left + rect.width &&
        bounds.bottom >= rect.top + rect.height;
      const area = bounds.width * bounds.height;
      if (containsBox && area < smallestArea) {
        target = el;
        smallestArea = area;
      }
    }
    return target || candidates[0] || null;
  }

  function findBoxSelectionTargets(rect) {
    const fullyContained = Array.from(document.querySelectorAll('*')).filter((el) => {
      if (!(el instanceof Element) || isOverlayElement(el)) return false;
      const bounds = el.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return false;
      return (
        bounds.left >= rect.left &&
        bounds.top >= rect.top &&
        bounds.right <= rect.left + rect.width &&
        bounds.bottom <= rect.top + rect.height
      );
    });

    // Keep the highest-level fully contained elements. Their text includes
    // nested content without duplicating every child node's text.
    return fullyContained.filter(
      (el) => !fullyContained.some((candidate) => candidate !== el && candidate.contains(el)),
    );
  }

  function onBoxSelectionStart(event) {
    if (!STATE.active || event.button !== 0) return;
    if (isExternalPickerActive()) return;
    if (isInsidePanel(event.target)) return;
    if (!StateStore.get('boxSelect')) {
      if (event.ctrlKey || event.metaKey || event.shiftKey) event.preventDefault();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    STATE.boxSelectionStart = { x: event.clientX, y: event.clientY };
    drawBoxSelection(getBoxSelectionRect(STATE.boxSelectionStart, event));
    window.addEventListener('mousemove', onBoxSelectionMove, true);
    window.addEventListener('mouseup', onBoxSelectionEnd, true);
  }

  function onBoxSelectionMove(event) {
    if (!STATE.boxSelectionStart) return;
    event.preventDefault();
    event.stopPropagation();
    drawBoxSelection(getBoxSelectionRect(STATE.boxSelectionStart, event));
  }

  function onBoxSelectionEnd(event) {
    const start = STATE.boxSelectionStart;
    STATE.boxSelectionStart = null;
    window.removeEventListener('mousemove', onBoxSelectionMove, true);
    window.removeEventListener('mouseup', onBoxSelectionEnd, true);
    if (!start) return;

    event.preventDefault();
    event.stopPropagation();
    const selectionRect = getBoxSelectionRect(start, event);
    const selectedElements = findBoxSelectionTargets(selectionRect);
    const target = selectedElements[0] || findBoxSelectionTarget(selectionRect);
    clearBoxSelectionOverlay();
    StateStore.set({ boxSelect: false });
    STATE.suppressClick = true;
    setTimeout(() => {
      STATE.suppressClick = false;
    }, 0);
    if (target) setSelection(target, selectedElements.length ? selectedElements : [target]);
  }

  function onKeyDown(e) {
    if (!STATE.active) return;

    if (isExternalPickerActive()) return;

    const codeDialog = STATE.box?.querySelector('#__em_code_dialog');
    if (codeDialog?.classList.contains('open') && e.key === 'Escape') {
      e.preventDefault();
      codeDialog.classList.remove('open');
      return;
    }

    // Check if the focused element is inside the panel - if so, don't handle selection keys
    if (isInsidePanel(e.target)) {
      // Key event is from panel, don't interfere
      if (e.key !== 'Escape') return; // Still allow Escape to close
    }

    // In execute mode, only handle Escape to close - don't intercept other keys
    // This allows real page interactions (typing, scrolling, etc.)
    const activeTab = StateStore.get('activeTab');
    if (activeTab === 'execute') {
      if (e.key === 'Escape') {
        e.preventDefault();
        stop();
      }
      return; // Don't intercept Space/Arrow keys in execute mode
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const t = STATE.hoverEl || STATE.selectedEl;
      if (t) {
        const sel = selectTarget(t, e);
        if (!IS_MAIN) reportFrameSelection(t, sel, e);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const base = STATE.selectedEl || STATE.hoverEl;
      if (base?.parentElement) setSelection(base.parentElement);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const base = STATE.selectedEl || STATE.hoverEl;
      if (base?.firstElementChild) setSelection(base.firstElementChild);
    }
  }

  function setSelection(el, selectedElements = null, selectionMode = null) {
    if (!(el instanceof Element) && !Array.isArray(selectedElements)) return;

    const elements = Array.isArray(selectedElements)
      ? selectedElements
      : StateStore.get('listMode')
        ? resolveListTargets(el)
        : [el];
    STATE.selectedElements = [...new Set(filterOverlayElements(elements))];
    STATE.selectedEl = STATE.selectedElements.includes(el)
      ? el
      : STATE.selectedElements.at(-1) || null;
    STATE.selectionMode = selectionMode;

    let selectorType = StateStore.get('selectorType');
    if (
      selectorType === 'xpath' &&
      STATE.selectedElements.some((element) => element.getRootNode() instanceof ShadowRoot)
    ) {
      selectorType = 'css';
      StateStore.set({ selectorType });
      const typeSelect = STATE.box?.querySelector('#__em_selector_type');
      if (typeSelect) typeSelect.value = selectorType;
    }
    const listMode = StateStore.get('listMode');

    const sel =
      selectionMode === 'manual'
        ? STATE.selectedElements
            .map((element) =>
              selectorType === 'xpath' ? generateXPath(element) : generateSelector(element),
            )
            .join(selectorType === 'xpath' ? ' | ' : ', ')
        : listMode
          ? selectorType === 'xpath'
            ? generateListXPath(el)
            : generateListSelector(el)
          : selectorType === 'xpath'
            ? generateXPath(el)
            : generateSelector(el);

    const name = STATE.selectedEl ? getElementName(STATE.selectedEl) : '';

    const selectorText = STATE.box?.querySelector('#__em_selector');
    const inputName = STATE.box?.querySelector('#__em_name');
    const selectorDisplay = STATE.box?.querySelector('#__em_selector_text');

    if (selectorText) {
      selectorText.textContent = sel;
      selectorText.title = sel;
    }
    if (selectorDisplay) {
      selectorDisplay.textContent = sel;
      selectorDisplay.title = sel;
    }
    if (inputName && (STATE.nameElement !== STATE.selectedEl || !inputName.value)) {
      inputName.value = name;
    }
    STATE.nameElement = STATE.selectedEl;

    if (STATE.selectedElements.length > 1) {
      drawRects(STATE.selectedElements, CONFIG.COLORS.PRIMARY, false);
    } else {
      clearRects();
    }
    if (STATE.selectedEl) moveHighlighterTo(STATE.selectedEl);
    else clearHighlighter();
    renderSelectionList();
    return sel;
  }

  function refreshSelectedSelector() {
    if (STATE.selectedEl) {
      setSelection(
        STATE.selectedEl,
        STATE.selectionMode === 'manual' ? STATE.selectedElements : null,
        STATE.selectionMode,
      );
    }
  }

  // ============================================================================
  // Validation Logic
  // ============================================================================

  /**
   * Verify selector by highlighting only (non-destructive)
   */
  async function verifyHighlightOnly() {
    try {
      const selector = STATE.box?.querySelector('#__em_selector')?.textContent?.trim();
      if (!selector || selector === '-') {
        StateStore.set({
          validation: {
            status: 'failure',
            message: 'Click a page element first, then check the match',
          },
        });
        return;
      }

      StateStore.set({
        validation: { status: 'running', message: 'Validating locator...' },
      });

      const selectorType = StateStore.get('selectorType');
      const effectiveType = selectorType;
      const isComposite = effectiveType === 'css' && selector.includes('|>');

      if (isComposite) {
        const result = await highlightSelectorExternal({ selector, selectorType: effectiveType });
        StateStore.set({
          validation: result.success
            ? { status: 'success', message: `Located ${result.count || 1} element(s)` }
            : { status: 'failure', message: result.error || 'No matching element found' },
        });
        return;
      }

      // Query for matches
      const matches =
        effectiveType === 'xpath' ? evaluateXPathAll(selector) : queryAllDeep(selector);

      // Additional defense: filter out any overlay elements that might have slipped through
      const filteredMatches = filterOverlayElements(matches);

      if (!filteredMatches || filteredMatches.length === 0) {
        StateStore.set({
          validation: { status: 'failure', message: 'No matching element found' },
        });
        return;
      }

      // Scroll first match into view
      const primaryMatch = filteredMatches[0];
      if (primaryMatch) {
        primaryMatch.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'smooth',
        });
      }

      await sleep(200);

      // Highlight matches with isVerify=true to prevent clearing on hover
      drawRects(filteredMatches, CONFIG.COLORS.VERIFY, false, true);

      StateStore.set({
        validation: {
          status: 'success',
          message: `Located ${filteredMatches.length} element(s)`,
        },
      });

      // Auto-clear highlight after 2 seconds
      setTimeout(() => {
        clearRects();
        StateStore.set({
          validation: { status: 'idle', message: '' },
        });
      }, 2000);
    } catch (error) {
      console.error('[verifyHighlightOnly] error:', error);
      StateStore.set({
        validation: { status: 'failure', message: error.message || 'Validation failed' },
      });
    }
  }

  /**
   * Execute action on selector (destructive)
   */
  async function verifySelectorNow() {
    try {
      const selector = STATE.box?.querySelector('#__em_selector')?.textContent?.trim();
      if (!selector || selector === '-') {
        StateStore.set({
          validation: {
            status: 'failure',
            message: 'Select an element first, then run validation',
          },
        });
        return;
      }

      StateStore.set({
        validation: { status: 'running', message: 'Running validation...' },
      });

      const selectorType = StateStore.get('selectorType');
      const listMode = StateStore.get('listMode');

      const effectiveType = selectorType;
      const isComposite = effectiveType === 'css' && selector.includes('|>');

      const matches = isComposite
        ? []
        : effectiveType === 'xpath'
          ? evaluateXPathAll(selector)
          : queryAllDeep(selector);

      // Additional defense: filter out any overlay elements that might have slipped through
      const filteredMatches = filterOverlayElements(matches);

      if (!isComposite && (!filteredMatches || filteredMatches.length === 0)) {
        StateStore.set({
          validation: { status: 'failure', message: 'No matching element found' },
        });
        return;
      }

      if (!isComposite) drawRects(filteredMatches, CONFIG.COLORS.VERIFY, false);

      const action = STATE.box?.querySelector('#__em_action')?.value || 'hover';

      const payload = {
        type: 'element_marker_validate',
        selector,
        selectorType: effectiveType,
        action,
        listMode,
      };

      // Action-specific parameters with validation
      if (action === 'type_text') {
        const actionText = String(
          STATE.box?.querySelector('#__em_action_text')?.value || '',
        ).trim();
        if (!actionText) {
          StateStore.set({
            validation: { status: 'failure', message: 'Text is required for type_text' },
          });
          return;
        }
        payload.text = actionText;
      }

      if (action === 'press_keys') {
        const actionKeys = String(
          STATE.box?.querySelector('#__em_action_keys')?.value || '',
        ).trim();
        if (!actionKeys) {
          StateStore.set({
            validation: { status: 'failure', message: 'Keys are required for press_keys' },
          });
          return;
        }
        payload.keys = actionKeys;
      }

      if (action === 'scroll') {
        const direction = STATE.box?.querySelector('#__em_scroll_direction')?.value || 'down';
        const rawAmount = Number(STATE.box?.querySelector('#__em_scroll_distance')?.value);
        // Clamp to 1-10 range (backend expects ticks, not pixels)
        const amount = Math.max(
          1,
          Math.min(Math.round(Number.isFinite(rawAmount) ? rawAmount : 3), 10),
        );
        payload.scrollDirection = direction;
        payload.scrollAmount = amount;
      }

      if (['left_click', 'double_click', 'right_click'].includes(action)) {
        payload.modifiers = {
          altKey: !!STATE.box?.querySelector('#__em_mod_alt')?.checked,
          ctrlKey: !!STATE.box?.querySelector('#__em_mod_ctrl')?.checked,
          metaKey: !!STATE.box?.querySelector('#__em_mod_meta')?.checked,
          shiftKey: !!STATE.box?.querySelector('#__em_mod_shift')?.checked,
        };
        payload.button = STATE.box?.querySelector('#__em_btn')?.value || 'left';
        payload.waitForNavigation = !!STATE.box?.querySelector('#__em_wait_nav')?.checked;
        payload.timeoutMs = Number(STATE.box?.querySelector('#__em_nav_timeout')?.value) || 3000;
      }

      const res = await chrome.runtime.sendMessage(payload);

      const newEntry = {
        action,
        success: !!res?.tool?.ok,
        timestamp: Date.now(),
        matchCount: isComposite ? 1 : filteredMatches.length,
      };
      const history = [...(StateStore.get('validationHistory') || []), newEntry].slice(-5);

      if (res?.tool?.ok) {
        StateStore.set({
          validation: {
            status: 'success',
            message: `✓ Validation succeeded (matched ${isComposite ? 1 : filteredMatches.length} element(s))`,
          },
          validationHistory: history,
        });
      } else {
        StateStore.set({
          validation: {
            status: 'failure',
            message: formatValidationError(res?.tool?.error || res?.error),
          },
          validationHistory: history,
        });
      }
    } catch (err) {
      const newEntry = {
        action: STATE.box?.querySelector('#__em_action')?.value || 'hover',
        success: false,
        timestamp: Date.now(),
        matchCount: 0,
      };
      const history = [...(StateStore.get('validationHistory') || []), newEntry].slice(-5);

      StateStore.set({
        validation: {
          status: 'failure',
          message: `Error: ${err.message}`,
        },
        validationHistory: history,
      });
    }
  }

  /**
   * Highlight selector from external request (popup/background)
   * Supports composite iframe selectors: "frameSelector |> innerSelector"
   */
  async function highlightSelectorExternal({ selector, selectorType = 'css', listMode = false }) {
    const normalized = String(selector || '').trim();
    if (!normalized) {
      return { success: false, error: 'selector is required' };
    }

    try {
      // Handle composite iframe selector
      if (normalized.includes('|>')) {
        const parts = normalized
          .split('|>')
          .map((s) => s.trim())
          .filter(Boolean);

        if (parts.length >= 2) {
          const frameSel = parts[0];
          const innerSel = parts.slice(1).join(' |> ');

          // Find frame element
          let frameEl = null;
          try {
            frameEl = queryAllDeep(frameSel)[0] || document.querySelector(frameSel);
          } catch {}

          if (
            !frameEl ||
            !(frameEl instanceof HTMLIFrameElement || frameEl instanceof HTMLFrameElement)
          ) {
            return { success: false, error: `Frame element not found: ${frameSel}` };
          }

          const cw = frameEl.contentWindow;
          if (!cw) {
            return { success: false, error: 'Unable to access frame contentWindow' };
          }

          // Forward highlight request to iframe
          return new Promise((resolve) => {
            const reqId = `em_highlight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const listener = (ev) => {
              try {
                const data = ev?.data;
                if (!data || data.type !== 'em-highlight-result' || data.reqId !== reqId) return;
                window.removeEventListener('message', listener, true);
                resolve(data.result);
              } catch {}
            };

            window.addEventListener('message', listener, true);
            setTimeout(() => {
              window.removeEventListener('message', listener, true);
              resolve({ success: false, error: 'Frame highlight timeout' });
            }, 3000);

            cw.postMessage(
              {
                type: 'em-highlight-request',
                reqId,
                selector: innerSel,
                selectorType,
                listMode,
              },
              '*',
            );
          });
        }
      }

      // Handle normal selector (non-iframe)
      const effectiveType = selectorType;
      const matches =
        effectiveType === 'xpath' ? evaluateXPathAll(normalized) : queryAllDeep(normalized);

      // Additional defense: filter out any overlay elements that might have slipped through
      const filteredMatches = filterOverlayElements(matches);

      if (!filteredMatches || filteredMatches.length === 0) {
        return { success: false, error: 'No elements found for selector' };
      }

      // Scroll first match into view
      const primaryMatch = filteredMatches[0];
      if (primaryMatch) {
        primaryMatch.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'smooth',
        });
      }

      await sleep(150);

      // Draw highlight rectangles
      drawRects(filteredMatches, CONFIG.COLORS.VERIFY, false);

      // Auto-clear after 2 seconds
      setTimeout(() => {
        clearRects();
      }, 2000);

      return { success: true, count: filteredMatches.length };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  }

  async function copySelectorNow() {
    try {
      const sel = STATE.box?.querySelector('#__em_selector')?.textContent?.trim();
      if (!sel || sel === '-') {
        StateStore.set({
          validation: { status: 'failure', message: 'Nothing to copy yet' },
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(sel);
      } catch {
        const textarea = document.createElement('textarea');
        try {
          textarea.value = sel;
          document.body.appendChild(textarea);
          textarea.select();
          if (!document.execCommand('copy')) throw new Error('Browser denied clipboard access');
        } finally {
          textarea.remove();
        }
      }

      StateStore.set({
        validation: { status: 'success', message: '✓ Copied to clipboard' },
      });

      setTimeout(() => {
        StateStore.set({ validation: { status: 'idle', message: '' } });
      }, 2000);
    } catch (error) {
      StateStore.set({
        validation: { status: 'failure', message: error?.message || 'Failed to copy locator' },
      });
    }
  }

  async function copySelectedElementTextNow() {
    try {
      const selected = STATE.selectedEl;
      if (!(selected instanceof Element)) {
        StateStore.set({
          validation: {
            status: 'failure',
            message: 'Click a page element first, then get its text',
          },
        });
        return;
      }

      const elements =
        Array.isArray(STATE.selectedElements) && STATE.selectedElements.length
          ? STATE.selectedElements
          : [selected];
      const value = elements
        .map((element) => {
          const text =
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement
              ? element.value
              : element.innerText || element.textContent || '';
          return text.trim();
        })
        .filter(Boolean)
        .join('\n');
      if (!value) {
        StateStore.set({
          validation: { status: 'failure', message: 'This element has no copyable text content' },
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const textarea = document.createElement('textarea');
        try {
          textarea.value = value;
          document.body.appendChild(textarea);
          textarea.select();
          if (!document.execCommand('copy')) throw new Error('Browser denied clipboard access');
        } finally {
          textarea.remove();
        }
      }

      StateStore.set({
        validation: { status: 'success', message: `✓ Copied element text (${value.length} chars)` },
      });

      setTimeout(() => {
        StateStore.set({ validation: { status: 'idle', message: '' } });
      }, 2000);
    } catch (error) {
      StateStore.set({
        validation: { status: 'failure', message: error?.message || 'Failed to get element text' },
      });
    }
  }

  function formatValidationError(error) {
    const message = String(error || 'Validation failed');
    if (message.includes('Provide ref or selector or coordinates for hover')) {
      return 'Cannot locate the element, select it again and validate';
    }
    return message;
  }

  function countLocalSelectorMatches(selector, selectorType) {
    if (selectorType === 'xpath') return evaluateXPathAll(selector).length;
    return queryAllDeep(selector).length;
  }

  async function countMemberMatches(member) {
    const framePath = Array.isArray(member.framePath) ? member.framePath : [];
    if (!framePath.length) {
      return {
        success: true,
        matchCount: countLocalSelectorMatches(member.selector, member.selectorType),
      };
    }

    const [segment, ...remainingPath] = framePath;
    const frames = queryAllDeep(segment.selector).filter(
      (element) => element instanceof HTMLIFrameElement || element instanceof HTMLFrameElement,
    );
    if (frames.length > 1) return { success: true, matchCount: frames.length };
    const frame = frames[0];
    if (!frame?.contentWindow) {
      return { success: false, matchCount: 0, error: 'iframe locator is no longer valid' };
    }
    if (segment.url && frame.getAttribute('src')) {
      try {
        if (new URL(frame.getAttribute('src'), location.href).href !== segment.url) {
          return { success: false, matchCount: 0, error: 'iframe page URL has changed' };
        }
      } catch {
        return { success: false, matchCount: 0, error: 'iframe page URL is invalid' };
      }
    }

    const reqId = `em_count_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        STATE.pendingMemberQueries.delete(reqId);
        resolve({ success: false, matchCount: 0, error: 'iframe is unreachable or timed out' });
      }, 2500);
      STATE.pendingMemberQueries.set(reqId, {
        source: frame.contentWindow,
        timer,
        resolve,
      });
      frame.contentWindow.postMessage(
        {
          type: 'em-member-count-request',
          reqId,
          member: { ...member, framePath: remainingPath },
        },
        '*',
      );
    });
  }

  function getMemberElementValue(element, valueType) {
    if (!element) return '';
    if (valueType === 'href') return element.href || element.getAttribute('href') || '';
    if (valueType === 'src') return element.src || element.getAttribute('src') || '';
    if (valueType === 'value') return element.value ?? element.getAttribute('value') ?? '';
    return String(element.innerText || element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function queryLocalMemberValue(member, valueType) {
    const element =
      member.selectorType === 'xpath'
        ? evaluateXPathAll(member.selector)[0]
        : queryAllDeep(member.selector)[0];
    if (!element) return { success: false, value: '', error: 'Element not found' };
    return { success: true, value: String(getMemberElementValue(element, valueType)) };
  }

  async function requestFrameMemberOperation(member, operation, valueType) {
    const [segment, ...remainingPath] = member.framePath || [];
    const frames = segment
      ? queryAllDeep(segment.selector).filter(
          (element) => element instanceof HTMLIFrameElement || element instanceof HTMLFrameElement,
        )
      : [];
    if (frames.length !== 1 || !frames[0]?.contentWindow) {
      return { success: false, value: '', error: 'iframe locator is invalid or not unique' };
    }
    const frame = frames[0];
    if (segment.url && frame.getAttribute('src')) {
      try {
        if (new URL(frame.getAttribute('src'), location.href).href !== segment.url) {
          return { success: false, value: '', error: 'iframe page URL has changed' };
        }
      } catch {
        return { success: false, value: '', error: 'iframe page URL is invalid' };
      }
    }
    const reqId = `em_query_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        STATE.pendingMemberQueries.delete(reqId);
        resolve({ success: false, value: '', error: 'iframe query timed out' });
      }, 2500);
      STATE.pendingMemberQueries.set(reqId, { source: frame.contentWindow, timer, resolve });
      frame.contentWindow.postMessage(
        {
          type: 'em-member-operation-request',
          reqId,
          operation,
          valueType,
          member: { ...member, framePath: remainingPath },
        },
        '*',
      );
    });
  }

  async function runMemberOperation(member, operation, valueType) {
    if (Array.isArray(member.framePath) && member.framePath.length) {
      return requestFrameMemberOperation(member, operation, valueType);
    }
    if (operation === 'count') {
      return {
        success: true,
        matchCount: countLocalSelectorMatches(member.selector, member.selectorType),
      };
    }
    return queryLocalMemberValue(member, valueType);
  }

  function getMarkerData() {
    const nameInput = STATE.box?.querySelector('#__em_name');
    const name = nameInput?.value?.trim();
    const members = getSelectedMarkerMembers();
    const selector = members[0] ? buildCompositeMemberSelector(members[0]) : '';
    if (!selector) return null;

    const selectorType = members[0]?.selectorType || StateStore.get('selectorType');
    const tags = (STATE.box?.querySelector('#__em_tags')?.value || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const hasGroup = members.length > 1 || STATE.selectionMode === 'manual';
    const groupId = hasGroup ? createMemberId() : undefined;
    return {
      name: name || (hasGroup ? `Element group (${members.length} item(s))` : selector),
      url: location.href,
      selector,
      selectorType,
      listMode: members.length > 1 || StateStore.get('listMode'),
      ...(tags.length ? { tags: [...new Set(tags)] } : {}),
      ...(hasGroup
        ? { groupId, groupName: name || `Element group (${members.length} item(s))` }
        : {}),
      ...(members.length > 1 || members[0]?.framePath?.length ? { members } : {}),
    };
  }

  function exportMarker() {
    const marker = getMarkerData();
    if (!marker) {
      StateStore.set({
        validation: {
          status: 'failure',
          message: 'Select an element first, then export the locator',
        },
      });
      return;
    }

    const dialog = STATE.box?.querySelector('#__em_code_dialog');
    if (!dialog) return;
    dialog.dataset.javascript = makeLocatorCode(marker, 'javascript');
    dialog.dataset.python = makeLocatorCode(marker, 'python');
    showLocatorCode('javascript');
    dialog.classList.add('open');
  }

  function makeLocatorCode(marker, language) {
    const selector = JSON.stringify(marker.selector);
    const multiple = !!marker.listMode;
    if (language === 'python') {
      const by = marker.selectorType === 'xpath' ? 'XPATH' : 'CSS_SELECTOR';
      return `from selenium.webdriver.common.by import By\n\n${multiple ? 'elements' : 'element'} = driver.find_${multiple ? 'elements' : 'element'}(By.${by}, ${selector})`;
    }
    if (marker.selectorType === 'xpath') {
      if (multiple) {
        return `const result = document.evaluate(${selector}, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);\nconst elements = Array.from({ length: result.snapshotLength }, (_, index) => result.snapshotItem(index));`;
      }
      return `const element = document.evaluate(${selector}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;`;
    }
    return `const ${multiple ? 'elements' : 'element'} = document.querySelector${multiple ? 'All' : ''}(${selector});`;
  }

  function showLocatorCode(language) {
    const dialog = STATE.box?.querySelector('#__em_code_dialog');
    const output = STATE.box?.querySelector('#__em_code_output');
    const copyButton = STATE.box?.querySelector('#__em_code_copy');
    if (!dialog || !output || !copyButton) return;
    const code = dialog.dataset[language] || '';
    output.textContent = code;
    copyButton.textContent = `Copy ${language === 'python' ? 'Python' : 'JavaScript'}`;
    dialog.dataset.codeLanguage = language;
    dialog.querySelectorAll('[data-code-language]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.codeLanguage === language);
    });
  }

  async function copyLocatorCode() {
    const dialog = STATE.box?.querySelector('#__em_code_dialog');
    const code = dialog?.dataset[dialog.dataset.codeLanguage || 'javascript'];
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    StateStore.set({
      validation: { status: 'success', message: '✓ Locator code copied to clipboard' },
    });
  }

  async function save(saveMode = 'group') {
    try {
      const marker = getMarkerData();
      if (!marker) {
        StateStore.set({
          validation: {
            status: 'failure',
            message: 'Select an element first, then save the marker',
          },
        });
        return;
      }
      let response;
      if (saveMode === 'separate' && Array.isArray(marker.members) && marker.members.length > 1) {
        const groupId = marker.groupId || createMemberId();
        const responses = await Promise.all(
          marker.members.map((member) =>
            chrome.runtime.sendMessage({
              type: 'element_marker_save',
              marker: {
                url: marker.url,
                name: member.name,
                selector: member.framePath?.length
                  ? buildCompositeMemberSelector(member)
                  : member.selector,
                selectorType: member.selectorType,
                listMode: false,
                groupId,
                groupName: marker.groupName || marker.name,
                tags: marker.tags,
                ...(member.framePath?.length ? { members: [member] } : {}),
              },
            }),
          ),
        );
        const failedCount = responses.filter((item) => !item?.success).length;
        response = failedCount
          ? { success: false, error: `Failed to save ${failedCount} element(s)` }
          : { success: true };
      } else {
        response = await chrome.runtime.sendMessage({
          type: 'element_marker_save',
          marker,
        });
      }
      StateStore.set({
        validation: response?.success
          ? {
              status: 'success',
              message:
                saveMode === 'separate'
                  ? '✓ Saved separately into the same group'
                  : '✓ Marker saved',
            }
          : { status: 'failure', message: response?.error || 'Save failed' },
      });
    } catch (error) {
      StateStore.set({
        validation: { status: 'failure', message: error?.message || 'Save failed' },
      });
    }
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  function start() {
    if (STATE.active) return;
    STATE.active = true;

    if (IS_MAIN) {
      const { host } = PanelHost.mount();
      STATE.box = host;
      StateStore.init();
      bindControls();
    }

    ensureHighlighter();
    ensureRectsHost();

    attachPointerListeners();
    attachKeyboardListener();
    syncInteractionMode();
    if (IS_MAIN) postToChildFrames({ type: 'em-activate' });
  }

  function stop() {
    STATE.active = false;
    StateStore.set({ boxSelect: false });
    if (STATE.selectionMode === 'manual') StateStore.set({ listMode: false });

    detachPointerListeners();
    detachKeyboardListener();

    // Cancel pending rAF
    if (STATE.hoverRafId != null) {
      cancelAnimationFrame(STATE.hoverRafId);
      STATE.hoverRafId = null;
    }
    pendingHoverEvent = null;

    try {
      STATE.highlighter?.remove();
      STATE.rectsHost?.remove();
      PanelHost.unmount();
      DragController.destroy();
    } catch {}

    STATE.highlighter = null;
    STATE.rectsHost = null;
    STATE.box = null;
    STATE.hoveredList = [];
    STATE.hoverEl = null;
    STATE.selectedEl = null;
    STATE.selectedElements = [];
    STATE.selectionMode = null;
    STATE.nameElement = null;
    STATE.lastHoverTarget = null;
    STATE.verifyRectsActive = false;
    STATE.boxSelectionStart = null;
    clearBoxSelectionOverlay();
    window.removeEventListener('mousemove', onBoxSelectionMove, true);
    window.removeEventListener('mouseup', onBoxSelectionEnd, true);

    // Clear rect pool to release DOM references
    STATE.rectPool.length = 0;
    STATE.rectPoolUsed = 0;
  }

  // ============================================================================
  // Controls Binding
  // ============================================================================

  function bindControls() {
    const host = STATE.box;
    if (!host) return;

    // Close/Cancel
    host.querySelector('#__em_close')?.addEventListener('click', stop);
    host.querySelector('#__em_cancel')?.addEventListener('click', stop);

    // Save
    host.querySelector('#__em_save')?.addEventListener('click', () => save('group'));
    host.querySelector('#__em_save_separate')?.addEventListener('click', () => save('separate'));
    host.querySelector('#__em_clear_selection')?.addEventListener('click', clearSelectedElements);
    host.querySelector('#__em_selection_scope')?.addEventListener('change', syncSimilarScope);
    host.querySelector('#__em_extract_selected')?.addEventListener('click', extractSelectedMembers);
    host.querySelector('#__em_copy_extract')?.addEventListener('click', copyExtractionRows);
    host.querySelector('#__em_download_extract')?.addEventListener('click', downloadExtractionCsv);
    host.querySelector('#__em_export')?.addEventListener('click', exportMarker);
    host.querySelector('#__em_code_close')?.addEventListener('click', () => {
      host.querySelector('#__em_code_dialog')?.classList.remove('open');
    });
    host.querySelector('#__em_code_dialog')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
    host.querySelectorAll('[data-code-language]').forEach((tab) => {
      tab.addEventListener('click', () => showLocatorCode(tab.dataset.codeLanguage));
    });
    host.querySelector('#__em_code_copy')?.addEventListener('click', copyLocatorCode);

    // Verify (highlight only) & Execute (real action)
    host.querySelector('#__em_verify')?.addEventListener('click', verifyHighlightOnly);
    host.querySelector('#__em_execute')?.addEventListener('click', verifySelectorNow);

    // Copy
    host.querySelector('#__em_copy')?.addEventListener('click', copySelectorNow);
    host.querySelector('#__em_copy_selector')?.addEventListener('click', copySelectorNow);
    host
      .querySelector('#__em_copy_element_text')
      ?.addEventListener('click', copySelectedElementTextNow);

    // Decide whether selecting an element should also replay the page click.
    host.querySelector('#__em_replay_click')?.addEventListener('change', (e) => {
      StateStore.set({ replaySiteClick: !!e.target.checked });
    });

    // Action change handler - show/hide action-specific options
    host.querySelector('#__em_action')?.addEventListener('change', (e) => {
      updateActionSpecificUI(e.target.value);
    });

    // Selector type
    host.querySelector('#__em_selector_type')?.addEventListener('change', (e) => {
      const newType = e.target.value;

      StateStore.set({ selectorType: newType });

      // Regenerate selector for the currently selected element
      if (STATE.selectedEl) {
        refreshSelectedSelector();
      }
      // Note: If no selectedEl (e.g., iframe selections or manual input),
      // preserve existing selector text instead of clearing it
    });

    // List mode toggle
    host.querySelector('#__em_toggle_list')?.addEventListener('click', (e) => {
      const listMode = StateStore.get('listMode');
      const newListMode = !listMode;

      StateStore.set({ listMode: newListMode });
      STATE.selectionMode = null;
      STATE.remoteSelectedMembers = [];

      // Update button active state
      const btn = e.currentTarget;
      if (btn) {
        if (newListMode) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }

      // Regenerate selector for the currently selected element
      if (STATE.selectedEl) {
        setSelection(STATE.selectedEl);
      }

      clearHighlighter();
    });

    host.querySelector('#__em_toggle_box')?.addEventListener('click', () => {
      StateStore.set({ boxSelect: !StateStore.get('boxSelect') });
    });

    // Tab toggle (switch between Attributes and Execute)
    host.querySelector('#__em_toggle_tab')?.addEventListener('click', () => {
      const currentTab = StateStore.get('activeTab');
      StateStore.set({ activeTab: currentTab === 'attributes' ? 'execute' : 'attributes' });
    });

    // Tab switching
    const tabs = host.querySelectorAll('.em-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        StateStore.set({ activeTab: tab.dataset.tab });
      });
    });

    // Navigation buttons
    host.querySelector('#__em_nav_up')?.addEventListener('click', () => {
      const base = STATE.selectedEl || STATE.hoverEl;
      if (base?.parentElement) setSelection(base.parentElement);
    });

    host.querySelector('#__em_nav_down')?.addEventListener('click', () => {
      const base = STATE.selectedEl || STATE.hoverEl;
      if (base?.firstElementChild) setSelection(base.firstElementChild);
    });

    // Preferences
    host.querySelector('#__em_pref_testid')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferTestId: !!e.target.checked };
      StateStore.set({ prefs });
      refreshSelectedSelector();
    });
    host.querySelector('#__em_pref_aria')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferAria: !!e.target.checked };
      StateStore.set({ prefs });
      refreshSelectedSelector();
    });
    host.querySelector('#__em_pref_text')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferText: !!e.target.checked };
      StateStore.set({ prefs });
      if (e.target.checked && StateStore.get('selectorType') !== 'xpath') {
        StateStore.set({ selectorType: 'xpath' });
        const typeSelect = host.querySelector('#__em_selector_type');
        if (typeSelect) typeSelect.value = 'xpath';
      }
      refreshSelectedSelector();
    });
    host.querySelector('#__em_pref_id')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferId: !!e.target.checked };
      StateStore.set({ prefs });
      refreshSelectedSelector();
    });
    host.querySelector('#__em_pref_attr')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferStableAttr: !!e.target.checked };
      StateStore.set({ prefs });
      refreshSelectedSelector();
    });
    host.querySelector('#__em_pref_class')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferClass: !!e.target.checked };
      StateStore.set({ prefs });
      refreshSelectedSelector();
    });

    // Drag - use entire header as drag handle
    const dragHandle = host.querySelector('#__em_drag_handle');
    if (dragHandle) {
      DragController.init(dragHandle);
    }

    syncUIWithState();
  }

  function updateActionSpecificUI(action) {
    const host = STATE.box;
    if (!host) return;

    // Hide all action-specific groups
    const textGroup = host.querySelector('#__em_action_text_group');
    const keysGroup = host.querySelector('#__em_action_keys_group');
    const scrollOptions = host.querySelector('#__em_scroll_options');
    const clickOptions = host.querySelector('#__em_click_options');

    if (textGroup) textGroup.style.display = 'none';
    if (keysGroup) keysGroup.style.display = 'none';
    if (scrollOptions) scrollOptions.style.display = 'none';
    if (clickOptions) clickOptions.style.display = 'none';

    // Show relevant options based on action
    if (action === 'type_text') {
      if (textGroup) textGroup.style.display = 'block';
    } else if (action === 'press_keys') {
      if (keysGroup) keysGroup.style.display = 'block';
    } else if (action === 'scroll') {
      if (scrollOptions) scrollOptions.style.display = 'block';
    } else if (['left_click', 'double_click', 'right_click'].includes(action)) {
      if (clickOptions) clickOptions.style.display = 'block';

      // For right_click, button selector is not relevant (always 'right')
      // Hide the button field for right_click
      const buttonField = host.querySelector('#__em_btn')?.closest('.em-field');
      if (buttonField) {
        buttonField.style.display = action === 'right_click' ? 'none' : 'block';
      }
    }
    // hover: no extra options needed
  }

  function syncUIWithState() {
    const host = STATE.box;
    if (!host) return;

    const state = StateStore.get();

    const typeSelect = host.querySelector('#__em_selector_type');
    if (typeSelect) typeSelect.value = state.selectorType;

    const replayClick = host.querySelector('#__em_replay_click');
    if (replayClick) replayClick.checked = state.replaySiteClick;

    // Initialize list mode button state
    const listModeBtn = host.querySelector('#__em_toggle_list');
    if (listModeBtn) {
      if (state.listMode) {
        listModeBtn.classList.add('active');
      } else {
        listModeBtn.classList.remove('active');
      }
      listModeBtn.setAttribute('aria-pressed', String(state.listMode));
    }

    const boxModeBtn = host.querySelector('#__em_toggle_box');
    if (boxModeBtn) {
      boxModeBtn.classList.toggle('active', state.boxSelect);
      boxModeBtn.setAttribute('aria-pressed', String(state.boxSelect));
    }

    const prefId = host.querySelector('#__em_pref_id');
    const prefTestId = host.querySelector('#__em_pref_testid');
    const prefAria = host.querySelector('#__em_pref_aria');
    const prefText = host.querySelector('#__em_pref_text');
    const prefAttr = host.querySelector('#__em_pref_attr');
    const prefClass = host.querySelector('#__em_pref_class');
    if (prefTestId) prefTestId.checked = state.prefs.preferTestId;
    if (prefAria) prefAria.checked = state.prefs.preferAria;
    if (prefText) prefText.checked = state.prefs.preferText;
    if (prefId) prefId.checked = state.prefs.preferId;
    if (prefAttr) prefAttr.checked = state.prefs.preferStableAttr;
    if (prefClass) prefClass.checked = state.prefs.preferClass;

    // Initialize action-specific UI
    const actionSelect = host.querySelector('#__em_action');
    if (actionSelect) {
      updateActionSpecificUI(actionSelect.value);
    }
  }

  // ============================================================================
  // Cross-Frame Bridge
  // ============================================================================

  // Register window message listener in all frames (not just main)
  // to support cross-frame highlighting from popup validation
  window.addEventListener(
    'message',
    (ev) => {
      try {
        const data = ev?.data;
        if (!data) return;

        if (data.type === 'em-member-count-result') {
          const pending = STATE.pendingMemberQueries.get(data.reqId);
          if (pending && ev.source === pending.source) {
            clearTimeout(pending.timer);
            STATE.pendingMemberQueries.delete(data.reqId);
            pending.resolve(data.result);
          }
          return;
        }
        if (data.type === 'em-member-operation-result') {
          const pending = STATE.pendingMemberQueries.get(data.reqId);
          if (pending && ev.source === pending.source) {
            clearTimeout(pending.timer);
            STATE.pendingMemberQueries.delete(data.reqId);
            pending.resolve(data.result);
          }
          return;
        }
        if (data.type === 'em-member-operation-request' && ev.source === window.parent) {
          runMemberOperation(data.member, data.operation, data.valueType)
            .then((result) =>
              window.parent.postMessage(
                {
                  type: 'em-member-operation-result',
                  reqId: data.reqId,
                  result,
                },
                '*',
              ),
            )
            .catch((error) =>
              window.parent.postMessage(
                {
                  type: 'em-member-operation-result',
                  reqId: data.reqId,
                  result: { success: false, value: '', error: error?.message || 'Query failed' },
                },
                '*',
              ),
            );
          return;
        }
        if (data.type === 'em-member-count-request' && ev.source === window.parent) {
          countMemberMatches(data.member)
            .then((result) =>
              window.parent.postMessage(
                {
                  type: 'em-member-count-result',
                  reqId: data.reqId,
                  result,
                },
                '*',
              ),
            )
            .catch((error) =>
              window.parent.postMessage(
                {
                  type: 'em-member-count-result',
                  reqId: data.reqId,
                  result: {
                    success: false,
                    matchCount: 0,
                    error: error?.message || 'Marker check failed',
                  },
                },
                '*',
              ),
            );
          return;
        }

        if (data.type === 'em-activate' && ev.source === window.parent && !IS_MAIN) {
          start();
          postToChildFrames({ type: 'em-activate' });
          return;
        }
        if (data.type === 'em-similar-scope' && ev.source === window.parent) {
          STATE.similarScope = data.scope === 'page' ? 'page' : 'region';
          postToChildFrames(data);
          return;
        }

        // Handle iframe highlight request (works even when overlay is inactive)
        if (data.type === 'em-highlight-request' && ev.source === window.parent) {
          highlightSelectorExternal({
            selector: data.selector,
            selectorType: data.selectorType || 'css',
            listMode: !!data.listMode,
          })
            .then((result) => {
              window.parent.postMessage(
                {
                  type: 'em-highlight-result',
                  reqId: data.reqId,
                  result,
                },
                '*',
              );
            })
            .catch((error) => {
              window.parent.postMessage(
                {
                  type: 'em-highlight-result',
                  reqId: data.reqId,
                  result: { success: false, error: error?.message || String(error) },
                },
                '*',
              );
            });
          return;
        }

        // Following messages only relevant when overlay is active
        if (!STATE.active) return;

        const iframes = Array.from(document.querySelectorAll('iframe'));
        const host = iframes.find((f) => {
          try {
            return f.contentWindow === ev.source;
          } catch {
            return false;
          }
        });

        if (!host) return;

        const base = host.getBoundingClientRect();
        const frameSegment = { selector: generateSelector(host) };
        try {
          const src = host.getAttribute('src');
          if (src) frameSegment.url = new URL(src, location.href).href;
        } catch {}
        const framePath = [frameSegment, ...(Array.isArray(data.framePath) ? data.framePath : [])];

        if (data.type === 'em_hover' && Array.isArray(data.rects)) {
          const rects = data.rects.map((rect) => ({
            ...rect,
            x: rect.x + base.left,
            y: rect.y + base.top,
          }));
          if (IS_MAIN) {
            drawRectBoxes(rects, {
              color: CONFIG.COLORS.HOVER,
              dashed: true,
            });
            if (!data.preview) {
              const status = STATE.box?.querySelector('#__em_similar_preview_status');
              if (status) status.textContent = '';
            }
            if (data.preview) {
              const status = STATE.box?.querySelector('#__em_similar_preview_status');
              if (status) {
                const scope = data.scope === 'page' ? 'current page' : 'current region';
                status.textContent = `Shift click will select ${data.previewCount || rects.length} item(s) (${scope})`;
              }
            }
          } else {
            window.parent.postMessage({ ...data, rects, framePath }, '*');
          }
        } else if (data.type === 'em_selection_update') {
          if (IS_MAIN) {
            const incoming = receiveFrameSelection(data, framePath);
            if (STATE.repairTarget && incoming.at(-1)) {
              completeMarkerRepair(incoming.at(-1));
            }
          } else window.parent.postMessage({ ...data, framePath }, '*');
        }
      } catch {}
    },
    true,
  );

  // ============================================================================
  // Message Handlers
  // ============================================================================

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === 'element_marker_start') {
      start();
      sendResponse({ ok: true });
      return true;
    } else if (request?.action === 'element_marker_ping') {
      sendResponse({ status: 'pong' });
      return false;
    } else if (request?.action === 'element_marker_count_matches') {
      countMemberMatches(request.member)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({
            success: false,
            matchCount: 0,
            error: error?.message || 'Marker check failed',
          }),
        );
      return true;
    } else if (request?.action === 'element_marker_extract_members') {
      const members = Array.isArray(request.members) ? request.members.slice(0, 100) : [];
      Promise.all(
        members.map(async (member) => {
          const result = await runMemberOperation(member, 'value', request.valueType || 'text');
          return {
            memberId: member.id,
            name: member.name,
            frame:
              member.framePath?.map((segment) => segment.selector).join(' → ') || 'Current page',
            value: result?.success ? result.value : '',
            error: result?.success ? '' : result?.error || 'Read failed',
          };
        }),
      )
        .then((rows) => sendResponse({ success: true, rows }))
        .catch((error) =>
          sendResponse({ success: false, error: error?.message || 'Extraction failed' }),
        );
      return true;
    } else if (request?.action === 'element_marker_reselect' && IS_MAIN) {
      STATE.repairTarget = {
        markerId: String(request.markerId || ''),
        memberId: String(request.memberId || request.markerId || ''),
      };
      StateStore.set({
        activeTab: 'attributes',
        validation: { status: 'idle', message: 'Click a new element on the page to locate' },
      });
      sendResponse({ success: true });
      return true;
    } else if (request?.action === 'element_marker_highlight_members') {
      const members = Array.isArray(request.members) ? request.members.slice(0, 100) : [];
      Promise.all(members.map((member) => locateMember(member)))
        .then((results) => {
          const failed = results.filter((result) => !result?.success);
          const response = {
            success: failed.length === 0,
            results,
            ...(failed.length
              ? { error: `${failed.length} marked element(s) could not be located` }
              : {}),
          };
          sendResponse(response);
        })
        .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }));
      return true;
    } else if (request?.action === 'element_marker_highlight') {
      highlightSelectorExternal({
        selector: request.selector,
        selectorType: request.selectorType,
        listMode: !!request.listMode,
      })
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }));
      return true;
    }
    return false;
  });
})();
