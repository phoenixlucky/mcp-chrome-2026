// node-specs-builtin.ts — builtin NodeSpecs shared for UI + runtime
import type { NodeSpec } from './node-spec';
import { registerNodeSpec } from './node-spec-registry';
import { STEP_TYPES } from './step-types';

export function registerBuiltinSpecs() {
  const nav: NodeSpec = {
    type: STEP_TYPES.NAVIGATE,
    version: 1,
    display: { label: 'Navigate', iconClass: 'icon-navigate', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'url',
        label: 'URL',
        type: 'string',
        required: true,
        placeholder: 'https://example.com',
        help: 'Target URL; supports {var} templates',
        default: '',
      },
    ],
    defaults: { url: '' },
    validate: (cfg) => {
      const errs: string[] = [];
      if (!cfg || !cfg.url || String(cfg.url).trim() === '') errs.push('URL is required');
      return errs;
    },
  };
  registerNodeSpec(nav);

  // Click / Dblclick
  registerNodeSpec({
    type: STEP_TYPES.CLICK,
    version: 1,
    display: { label: 'Click', iconClass: 'icon-click', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'target',
        label: 'Target',
        type: 'json',
        widget: 'targetlocator',
        help: 'Pick or type an element selector',
      },
      {
        key: 'before',
        label: 'Before',
        type: 'object',
        fields: [
          { key: 'scrollIntoView', label: 'Scroll into view', type: 'boolean', default: true },
          { key: 'waitForSelector', label: 'Wait for selector', type: 'boolean', default: true },
        ],
      },
      {
        key: 'after',
        label: 'After',
        type: 'object',
        fields: [
          {
            key: 'waitForNavigation',
            label: 'Wait for navigation',
            type: 'boolean',
            default: false,
          },
          {
            key: 'waitForNetworkIdle',
            label: 'Wait for network idle',
            type: 'boolean',
            default: false,
          },
        ],
      },
    ],
    defaults: {
      before: { scrollIntoView: true, waitForSelector: true },
      after: { waitForNavigation: false, waitForNetworkIdle: false },
    },
  });
  registerNodeSpec({
    type: STEP_TYPES.DBLCLICK,
    version: 1,
    display: { label: 'Double click', iconClass: 'icon-click', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'target', label: 'Target', type: 'json', widget: 'targetlocator' },
      {
        key: 'before',
        label: 'Before',
        type: 'object',
        fields: [
          { key: 'scrollIntoView', label: 'Scroll into view', type: 'boolean', default: true },
          { key: 'waitForSelector', label: 'Wait for selector', type: 'boolean', default: true },
        ],
      },
      {
        key: 'after',
        label: 'After',
        type: 'object',
        fields: [
          {
            key: 'waitForNavigation',
            label: 'Wait for navigation',
            type: 'boolean',
            default: false,
          },
          {
            key: 'waitForNetworkIdle',
            label: 'Wait for network idle',
            type: 'boolean',
            default: false,
          },
        ],
      },
    ],
    defaults: {
      before: { scrollIntoView: true, waitForSelector: true },
      after: { waitForNavigation: false, waitForNetworkIdle: false },
    },
  });

  // Fill
  registerNodeSpec({
    type: STEP_TYPES.FILL,
    version: 1,
    display: { label: 'Fill', iconClass: 'icon-fill', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'target', label: 'Target', type: 'json', widget: 'targetlocator' },
      {
        key: 'value',
        label: 'Value',
        type: 'string',
        required: true,
        help: 'Supports {var} templates',
      },
    ],
    defaults: { value: '' },
  });

  // Key
  registerNodeSpec({
    type: STEP_TYPES.KEY,
    version: 1,
    display: { label: 'Key', iconClass: 'icon-key', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'keys',
        label: 'Key sequence',
        type: 'string',
        widget: 'keysequence',
        required: true,
        help: 'e.g. Backspace Enter or cmd+a',
      },
      { key: 'target', label: 'Focus target (optional)', type: 'json', widget: 'targetlocator' },
    ],
    defaults: { keys: '' },
  });

  // Scroll
  registerNodeSpec({
    type: STEP_TYPES.SCROLL,
    version: 1,
    display: { label: 'Scroll', iconClass: 'icon-scroll', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { label: 'Element', value: 'element' },
          { label: 'Page offset (recommended)', value: 'offset' },
          { label: 'Container', value: 'container' },
        ] as any,
        default: 'offset',
      },
      {
        key: 'target',
        label: 'Target (element/container mode)',
        type: 'json',
        widget: 'targetlocator',
      },
      {
        key: 'offset',
        label: 'Offset',
        type: 'object',
        fields: [
          { key: 'x', label: 'X', type: 'number' },
          { key: 'y', label: 'Y', type: 'number' },
        ],
      },
    ],
    defaults: { mode: 'offset', offset: { x: 0, y: 300 } },
  });

  // Drag
  registerNodeSpec({
    type: STEP_TYPES.DRAG,
    version: 1,
    display: { label: 'Drag', iconClass: 'icon-drag', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'start', label: 'Start', type: 'json', widget: 'targetlocator' },
      { key: 'end', label: 'End', type: 'json', widget: 'targetlocator' },
      {
        key: 'path',
        label: 'Path points',
        type: 'array',
        item: {
          key: 'p',
          label: 'Point',
          type: 'object',
          fields: [
            { key: 'x', label: 'X', type: 'number' },
            { key: 'y', label: 'Y', type: 'number' },
          ],
        } as any,
      },
    ],
    defaults: {},
  });

  // Wait
  registerNodeSpec({
    type: STEP_TYPES.WAIT,
    version: 1,
    display: { label: 'Wait', iconClass: 'icon-wait', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'condition',
        label: 'Condition (JSON)',
        type: 'json',
        help: 'e.g. {"sleep":1000} or {"text":"Hello","appear":true}',
      },
    ],
    defaults: { condition: { sleep: 500 } },
  });

  // Assert
  registerNodeSpec({
    type: STEP_TYPES.ASSERT,
    version: 1,
    display: { label: 'Assert', iconClass: 'icon-assert', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }, { label: 'onError' }] },
    schema: [
      {
        key: 'assert',
        label: 'Assertion (JSON)',
        type: 'json',
        help: 'e.g. {"exists":"#id"} / {"visible":".btn"}',
      },
      {
        key: 'failStrategy',
        label: 'Failure strategy',
        type: 'select',
        options: [
          { label: 'Stop', value: 'stop' },
          { label: 'Warn', value: 'warn' },
          { label: 'Retry', value: 'retry' },
        ] as any,
        default: 'stop',
      },
    ],
    defaults: { assert: {} },
  });

  // HTTP
  registerNodeSpec({
    type: STEP_TYPES.HTTP,
    version: 1,
    display: { label: 'HTTP', iconClass: 'icon-http', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({
          label: m === 'GET' ? 'GET (recommended)' : m,
          value: m,
        })) as any,
        default: 'GET',
      },
      { key: 'url', label: 'URL', type: 'string', required: true },
      { key: 'headers', label: 'Headers (JSON)', type: 'json' },
      { key: 'body', label: 'Body (JSON)', type: 'json' },
      { key: 'formData', label: 'Form data (JSON)', type: 'json' },
      { key: 'saveAs', label: 'Save as variable', type: 'string' },
      { key: 'assign', label: 'Mapping (JSON)', type: 'json' },
    ],
    defaults: { method: 'GET', headers: {}, saveAs: 'response' },
  });

  // Extract
  registerNodeSpec({
    type: STEP_TYPES.EXTRACT,
    version: 1,
    display: { label: 'Extract', iconClass: 'icon-extract', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'mode',
        label: 'Extraction mode',
        type: 'select',
        options: [
          { label: 'Selector (recommended)', value: 'selector' },
          { label: 'Custom JS', value: 'js' },
        ] as any,
        default: 'selector',
      },
      { key: 'selector', label: 'Selector', type: 'string', widget: 'selector' },
      {
        key: 'attr',
        label: 'Attribute',
        type: 'select',
        options: [
          { label: 'Text (recommended)', value: 'text' },
          { label: 'Text (textContent)', value: 'textContent' },
          { label: 'Custom attribute name', value: 'attr' },
        ] as any,
      },
      {
        key: 'js',
        label: 'Custom JS',
        type: 'string',
        help: 'Runs in the page and returns a value',
      },
      { key: 'saveAs', label: 'Save variable', type: 'string', required: true },
    ],
    defaults: { mode: 'selector', attr: 'text', saveAs: 'result' },
  });

  // Screenshot
  registerNodeSpec({
    type: STEP_TYPES.SCREENSHOT,
    version: 1,
    display: { label: 'Screenshot', iconClass: 'icon-screenshot', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'selector', label: 'Target selector', type: 'string' },
      { key: 'fullPage', label: 'Full-page screenshot', type: 'boolean', default: false },
      { key: 'saveAs', label: 'Save variable', type: 'string' },
    ],
    defaults: { fullPage: false, saveAs: 'screenshot' },
  });

  registerNodeSpec({
    type: STEP_TYPES.GET_TAB_URL,
    version: 1,
    display: { label: 'Get tab info', iconClass: 'icon-http', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'tabId', label: 'Tab ID (0 for the current page)', type: 'number', default: 0 },
      { key: 'saveAs', label: 'Save variable', type: 'string', required: true },
    ],
    defaults: { tabId: 0, saveAs: 'tabInfo' },
    validate: (cfg) => (!String(cfg?.saveAs || '').trim() ? ['A variable name is required'] : []),
  });

  registerNodeSpec({
    type: STEP_TYPES.READ_PAGE,
    version: 1,
    display: { label: 'Get page elements', iconClass: 'icon-extract', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'filter',
        label: 'Filter',
        type: 'select',
        options: [{ label: 'Interactive elements', value: 'interactive' }] as any,
        default: 'interactive',
      },
      { key: 'depth', label: 'Max depth (empty = unlimited)', type: 'number', min: 0 },
      { key: 'saveAs', label: 'Save variable', type: 'string', required: true },
    ],
    defaults: { filter: 'interactive', saveAs: 'page' },
    validate: (cfg) => (!String(cfg?.saveAs || '').trim() ? ['A variable name is required'] : []),
  });

  registerNodeSpec({
    type: STEP_TYPES.GET_WEB_CONTENT,
    version: 1,
    display: { label: 'Get page content', iconClass: 'icon-script', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'htmlContent', label: 'Get HTML', type: 'boolean', default: false },
      { key: 'textContent', label: 'Get text', type: 'boolean', default: true },
      { key: 'selector', label: 'Scope selector (optional)', type: 'string', widget: 'selector' },
      { key: 'saveAs', label: 'Save variable', type: 'string', required: true },
    ],
    defaults: { htmlContent: false, textContent: true, selector: '', saveAs: 'content' },
    validate: (cfg) => (!String(cfg?.saveAs || '').trim() ? ['A variable name is required'] : []),
  });

  // TriggerEvent
  registerNodeSpec({
    type: STEP_TYPES.TRIGGER_EVENT,
    version: 1,
    display: { label: 'Trigger event', iconClass: 'icon-trigger', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'target', label: 'Target', type: 'json', widget: 'targetlocator' },
      { key: 'event', label: 'Event type', type: 'string', required: true },
      { key: 'bubbles', label: 'Bubbles', type: 'boolean', default: true },
      { key: 'cancelable', label: 'Cancelable', type: 'boolean', default: false },
    ],
    defaults: { event: 'click', bubbles: true, cancelable: false },
  });

  // SetAttribute
  registerNodeSpec({
    type: STEP_TYPES.SET_ATTRIBUTE,
    version: 1,
    display: { label: 'Set attribute', iconClass: 'icon-attr', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'target', label: 'Target', type: 'json', widget: 'targetlocator' },
      { key: 'name', label: 'Attribute name', type: 'string', required: true },
      { key: 'value', label: 'Attribute value', type: 'string' },
      { key: 'remove', label: 'Remove attribute', type: 'boolean', default: false },
    ],
    defaults: { remove: false },
  });

  // LoopElements
  registerNodeSpec({
    type: STEP_TYPES.LOOP_ELEMENTS,
    version: 1,
    display: { label: 'Loop elements', iconClass: 'icon-loop', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'selector', label: 'Selector', type: 'string', required: true },
      { key: 'saveAs', label: 'List variable name', type: 'string', default: 'elements' },
      { key: 'itemVar', label: 'Item variable name', type: 'string', default: 'item' },
      { key: 'subflowId', label: 'Subflow ID', type: 'string', required: true },
    ],
    defaults: { saveAs: 'elements', itemVar: 'item' },
  });

  // SwitchFrame
  registerNodeSpec({
    type: STEP_TYPES.SWITCH_FRAME,
    version: 1,
    display: { label: 'Switch frame', iconClass: 'icon-frame', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'frame',
        label: 'Frame locator',
        type: 'object',
        fields: [
          { key: 'index', label: 'Index', type: 'number' },
          { key: 'urlContains', label: 'URL contains', type: 'string' },
        ],
      },
    ],
    defaults: {},
  });

  // HandleDownload
  registerNodeSpec({
    type: STEP_TYPES.HANDLE_DOWNLOAD,
    version: 1,
    display: { label: 'Handle download', iconClass: 'icon-download', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'filenameContains', label: 'Filename contains', type: 'string' },
      { key: 'waitForComplete', label: 'Wait for completion', type: 'boolean', default: true },
      { key: 'timeoutMs', label: 'Timeout (ms)', type: 'number', default: 60000 },
      { key: 'saveAs', label: 'Save variable', type: 'string' },
    ],
    defaults: { waitForComplete: true, timeoutMs: 60000, saveAs: 'download' },
  });

  // Script
  registerNodeSpec({
    type: STEP_TYPES.SCRIPT,
    version: 1,
    display: { label: 'Script', iconClass: 'icon-script', category: 'Tools' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'world',
        label: 'Execution context',
        type: 'select',
        options: [
          { label: 'ISOLATED', value: 'ISOLATED' },
          { label: 'MAIN', value: 'MAIN' },
        ] as any,
        default: 'ISOLATED',
      },
      { key: 'code', label: 'Script code', type: 'string', widget: 'code', required: true },
      {
        key: 'when',
        label: 'Run timing',
        type: 'select',
        options: [
          { label: 'before', value: 'before' },
          { label: 'after', value: 'after' },
        ] as any,
        default: 'after',
      },
      { key: 'assign', label: 'Mapping (JSON)', type: 'json' },
      { key: 'saveAs', label: 'Save variable', type: 'string' },
    ],
    defaults: { world: 'ISOLATED', when: 'after' },
  });

  // Tabs
  registerNodeSpec({
    type: STEP_TYPES.OPEN_TAB,
    version: 1,
    display: { label: 'Open tab', iconClass: 'icon-openTab', category: 'Tabs' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'url', label: 'URL', type: 'string' },
      { key: 'newWindow', label: 'New window', type: 'boolean', default: false },
    ],
    defaults: { newWindow: false },
  });
  registerNodeSpec({
    type: 'executeFlow' as any,
    version: 1,
    display: { label: 'Run subflow', iconClass: 'icon-exec', category: 'Flow' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'flowId', label: 'Flow ID', type: 'string', required: true },
      { key: 'inline', label: 'Inline run', type: 'boolean', default: false },
      { key: 'args', label: 'Args (JSON)', type: 'json' },
    ],
    defaults: { inline: false },
  });
  registerNodeSpec({
    type: STEP_TYPES.SWITCH_TAB,
    version: 1,
    display: { label: 'Switch tab', iconClass: 'icon-switchTab', category: 'Tabs' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'tabId', label: 'TabId', type: 'number' },
      { key: 'urlContains', label: 'URL contains', type: 'string' },
      { key: 'titleContains', label: 'Title contains', type: 'string' },
    ],
    defaults: {},
  });
  registerNodeSpec({
    type: STEP_TYPES.CLOSE_TAB,
    version: 1,
    display: { label: 'Close tab', iconClass: 'icon-closeTab', category: 'Tabs' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'tabIds',
        label: 'TabIds',
        type: 'array',
        item: { key: 'id', label: 'id', type: 'number' } as any,
      },
      { key: 'url', label: 'URL', type: 'string' },
    ],
    defaults: {},
  });

  // Logic
  registerNodeSpec({
    type: STEP_TYPES.IF,
    version: 1,
    display: { label: 'Condition', iconClass: 'icon-if', category: 'Logic' },
    ports: { inputs: 1, outputs: 'any' },
    schema: [
      {
        key: 'condition',
        label: 'Condition expression (JSON)',
        type: 'json',
        help: 'e.g. {"expression":"vars.a>0"}',
      },
      {
        key: 'branches',
        label: 'Branches',
        type: 'array',
        item: {
          key: 'b',
          label: 'case',
          type: 'object',
          fields: [
            { key: 'id', label: 'ID', type: 'string' },
            { key: 'name', label: 'Name', type: 'string' },
            { key: 'expr', label: 'Expression', type: 'string' },
          ],
        } as any,
      },
      { key: 'else', label: 'Enable else', type: 'boolean', default: true },
    ],
    defaults: { else: true },
  });
  registerNodeSpec({
    type: STEP_TYPES.FOREACH,
    version: 1,
    display: { label: 'Loop', iconClass: 'icon-foreach', category: 'Logic' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'listVar', label: 'List variable', type: 'string', required: true },
      { key: 'itemVar', label: 'Item variable', type: 'string', default: 'item' },
      { key: 'subflowId', label: 'Subflow ID', type: 'string', required: true },
      {
        key: 'concurrency',
        label: 'Concurrency',
        type: 'number',
        default: 1,
        help: 'Run subflows concurrently (variables are shallow-copied and not merged automatically)',
      },
    ],
    defaults: { itemVar: 'item', concurrency: 1 },
  });
  registerNodeSpec({
    type: STEP_TYPES.WHILE,
    version: 1,
    display: { label: 'Loop', iconClass: 'icon-while', category: 'Logic' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'condition', label: 'Condition (JSON)', type: 'json' },
      { key: 'subflowId', label: 'Subflow ID', type: 'string', required: true },
      { key: 'maxIterations', label: 'Max iterations', type: 'number', default: 100 },
    ],
    defaults: { maxIterations: 100 },
  });

  // Delay (UI-only helper)
  registerNodeSpec({
    type: STEP_TYPES.DELAY,
    version: 1,
    display: { label: 'Delay', iconClass: 'icon-delay', category: 'Actions' },
    ports: { inputs: 1, outputs: [{ label: 'default' }] },
    schema: [
      {
        key: 'sleep',
        label: 'Delay',
        type: 'number',
        widget: 'duration',
        required: true,
        default: 1000,
      },
    ],
    defaults: { sleep: 1000 },
  });

  // Trigger (builder-only, flow-level node)
  registerNodeSpec({
    type: STEP_TYPES.TRIGGER,
    version: 1,
    display: { label: 'Trigger', iconClass: 'icon-trigger', category: 'Flow' },
    ports: { inputs: 0, outputs: [{ label: 'default' }] },
    schema: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', default: true },
      { key: 'description', label: 'Description', type: 'string' },
      {
        key: 'modes',
        label: 'Mode',
        type: 'object',
        fields: [
          { key: 'manual', label: 'Manual', type: 'boolean', default: true },
          { key: 'url', label: 'URL trigger', type: 'boolean', default: false },
          { key: 'contextMenu', label: 'Context menu', type: 'boolean', default: false },
          { key: 'command', label: 'Shortcut', type: 'boolean', default: false },
          { key: 'dom', label: 'DOM event', type: 'boolean', default: false },
          { key: 'schedule', label: 'Schedule', type: 'boolean', default: false },
        ],
      },
      {
        key: 'url',
        label: 'URL rules',
        type: 'object',
        fields: [
          {
            key: 'rules',
            label: 'Rule list',
            type: 'array',
            item: {
              key: 'rule',
              label: 'Rule',
              type: 'object',
              fields: [
                {
                  key: 'kind',
                  label: 'Type',
                  type: 'select',
                  options: [
                    { label: 'URL', value: 'url' },
                    { label: 'Domain', value: 'domain' },
                    { label: 'Path', value: 'path' },
                  ] as any,
                  default: 'url',
                },
                { key: 'value', label: 'Value', type: 'string' },
              ],
            } as any,
          },
        ],
      },
      {
        key: 'contextMenu',
        label: 'Context menu',
        type: 'object',
        fields: [
          { key: 'title', label: 'Title', type: 'string', default: 'Run workflow' },
          { key: 'enabled', label: 'Enabled', type: 'boolean', default: false },
        ],
      },
      {
        key: 'command',
        label: 'Shortcut',
        type: 'object',
        fields: [
          { key: 'commandKey', label: 'Shortcut', type: 'string' },
          { key: 'enabled', label: 'Enabled', type: 'boolean', default: false },
        ],
      },
      {
        key: 'dom',
        label: 'DOM event',
        type: 'object',
        fields: [
          { key: 'selector', label: 'Selector', type: 'string' },
          { key: 'appear', label: 'Appear', type: 'boolean', default: true },
          { key: 'once', label: 'Once', type: 'boolean', default: true },
          { key: 'debounceMs', label: 'Debounce (ms)', type: 'number', default: 800 },
          { key: 'enabled', label: 'Enabled', type: 'boolean', default: false },
        ],
      },
      {
        key: 'schedules',
        label: 'Schedule',
        type: 'array',
        item: {
          key: 'sched',
          label: 'Schedule',
          type: 'object',
          fields: [
            { key: 'id', label: 'ID', type: 'string' },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { label: 'Once', value: 'once' },
                { label: 'Interval', value: 'interval' },
                { label: 'Daily', value: 'daily' },
              ] as any,
            },
            { key: 'when', label: 'Time (ISO/cron)', type: 'string' },
            { key: 'enabled', label: 'Enabled', type: 'boolean', default: true },
          ],
        } as any,
      },
    ],
    defaults: { enabled: true },
  });
}
