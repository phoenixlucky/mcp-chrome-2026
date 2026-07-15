import { ToolResult } from '@/common/tool-handler';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { clickTool } from './interaction';
import { waitTool } from './wait';

interface ClickAndWaitParams {
  selector: string;
  waitSelector: string;
  waitFor?: 'visible' | 'present' | 'hidden' | 'gone' | 'enabled';
  waitTimeout?: number;
  tabId?: number;
  windowId?: number;
  frameId?: number;
  frameSelector?: string;
}

function resultData(result: ToolResult): unknown {
  const text = result.content?.[0]?.type === 'text' ? result.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class ClickAndWaitTool {
  name = TOOL_NAMES.BROWSER.CLICK_AND_WAIT;

  async execute(args: ClickAndWaitParams): Promise<ToolResult> {
    const click = await clickTool.execute({
      selector: args.selector,
      tabId: args.tabId,
      windowId: args.windowId,
      frameId: args.frameId,
    });
    if (click.isError) return click;

    const wait = await waitTool.execute({
      selector: args.waitSelector,
      waitFor: args.waitFor,
      timeout: args.waitTimeout,
      tabId: args.tabId,
      windowId: args.windowId,
      frameSelector: args.frameSelector,
    });
    if (wait.isError) return wait;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ click: resultData(click), wait: resultData(wait) }),
        },
      ],
      isError: false,
    };
  }
}

export const clickAndWaitTool = new ClickAndWaitTool();
