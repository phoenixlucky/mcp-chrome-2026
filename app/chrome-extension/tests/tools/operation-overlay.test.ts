import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    withSession: vi.fn((_tabId: number, _key: string, run: () => unknown) => run()),
    sendCommand: vi.fn().mockResolvedValue({ result: { value: true } }),
    attach: vi.fn().mockResolvedValue(undefined),
    detach: vi.fn().mockResolvedValue(undefined),
  },
}));

import { handleCallTool } from '@/entrypoints/background/tools';

// chrome.storage.local.get is overloaded; the zero-arg overload types as Promise<void>
const storageGet = vi.mocked(
  chrome.storage.local.get as unknown as () => Promise<Record<string, unknown>>,
);

interface InjectedCall {
  args: unknown[];
  func: (...args: unknown[]) => void;
}

function installScriptingMock(): InjectedCall[] {
  const calls: InjectedCall[] = [];
  const executeScript = vi.fn(async (opts: InjectedCall) => {
    calls.push(opts);
    return [{ result: undefined }];
  });
  // chrome.scripting is absent from the shared chrome test placeholder
  const chromeGlobal = globalThis.chrome as unknown as { scripting: unknown };
  chromeGlobal.scripting = { executeScript };
  return calls;
}

describe('overlay smoke', () => {
  it('renders English overlay text and rewrites via the injected func', async () => {
    const calls = installScriptingMock();
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 5,
      url: 'https://example.com',
    } as chrome.tabs.Tab);
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true, message: 'ok' });
    storageGet.mockResolvedValue({ backgroundOperations: true });

    await handleCallTool({
      name: 'chrome_click_element',
      args: { selector: '#go', intent: 'submit the form', tabId: 5 },
    });
    const running = calls[0];
    expect(running.args[4]).toBe('Running');
    expect(running.args[5]).toBe('Target: #go');
    expect(running.args[6]).toBe('submit the form');

    const btn = document.createElement('button');
    btn.id = 'go';
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '  Go   now ';
    document.body.append(btn);

    running.func(
      'chrome_click_element',
      '#go',
      null,
      null,
      'Running',
      'Target: #go',
      'submit the form',
    );

    const status = document.getElementById('__mcp_operation_status__');
    expect(status?.textContent).toBe('Running: Click\nExpand: Go now\nIntent: submit the form');

    await handleCallTool({
      name: 'chrome_click_element',
      args: { selector: '#go', intent: 'submit the form', tabId: 5 },
    });
    expect(calls[calls.length - 1].args[4]).toBe('Done');
  });

  it('joiner is "; " so click-and-wait keeps the wait clause', async () => {
    const calls = installScriptingMock();
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 5,
      url: 'https://example.com',
    } as chrome.tabs.Tab);
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true, message: 'ok' });

    await handleCallTool({
      name: 'chrome_click_and_wait',
      args: {
        selector: '#go',
        waitSelector: '#done',
        waitFor: 'visible',
        waitTimeout: 5000,
        tabId: 5,
      },
    });
    const detail = calls[0].args[5] as string;
    expect(detail).toContain('; wait #done visible (up to 5s)');

    const btn = document.createElement('button');
    btn.id = 'go2';
    btn.textContent = 'Go';
    document.body.append(btn);
    calls[0].func(
      'chrome_click_and_wait',
      '#go2',
      null,
      null,
      'Running',
      'Click: #go2; wait #done visible (up to 5s)',
      null,
    );
    const status = document.getElementById('__mcp_operation_status__');
    expect(status?.textContent).toBe(
      'Running: Click and wait\nClick: Go; wait #done visible (up to 5s)',
    );
  });

  it('scroll detail prefix rewrites element names', async () => {
    const calls = installScriptingMock();
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 5,
      url: 'https://example.com',
    } as chrome.tabs.Tab);
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true, message: 'ok' });

    await handleCallTool({
      name: 'chrome_scroll',
      args: { selector: '#list', scrollIntoView: true, tabId: 5 },
    });
    expect(calls[0].args[5]).toBe('Scrolled to: #list');
    const el = document.createElement('div');
    el.id = 'list';
    el.textContent = 'List';
    document.body.append(el);
    calls[0].func('chrome_scroll', '#list', null, null, 'Running', 'Scrolled to: #list', null);
    const status = document.getElementById('__mcp_operation_status__');
    expect(status?.textContent).toBe('Running: Scroll\nScrolled to: List');

    await handleCallTool({ name: 'chrome_scroll', args: { toBottom: true, tabId: 5 } });
    expect(calls[calls.length - 1].args[5]).toBe('Scrolled to bottom');
  });
});
