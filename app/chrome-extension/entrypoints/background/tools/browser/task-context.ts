import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';

interface TaskContextParams {
  action: 'create' | 'get' | 'save' | 'clear' | 'close';
  taskId: string;
  url?: string;
  state?: Record<string, unknown>;
}

const KEY = 'mcp_scrape_tasks';
type StoredTask = {
  windowId?: number;
  tabId?: number;
  state: Record<string, unknown>;
  updatedAt: number;
};

class TaskContextTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TASK_CONTEXT;

  async execute(args: TaskContextParams): Promise<ToolResult> {
    if (!args?.taskId || !['create', 'get', 'save', 'clear', 'close'].includes(args.action)) {
      return createErrorResponse('taskId and a valid action are required.');
    }
    const tasks = ((await chrome.storage.local.get(KEY))[KEY] || {}) as Record<string, StoredTask>;
    const task = tasks[args.taskId];

    if (args.action === 'get') return this.result(args.taskId, task || null);
    if (args.action === 'clear') {
      delete tasks[args.taskId];
      await chrome.storage.local.set({ [KEY]: tasks });
      return this.result(args.taskId, null);
    }
    if (args.action === 'close') {
      if (task?.windowId) await chrome.windows.remove(task.windowId).catch(() => undefined);
      delete tasks[args.taskId];
      await chrome.storage.local.set({ [KEY]: tasks });
      return this.result(args.taskId, null);
    }
    if (args.action === 'save') {
      if (!task) return createErrorResponse(`Task ${args.taskId} does not exist; create it first.`);
      task.state = args.state || task.state;
      task.updatedAt = Date.now();
      await chrome.storage.local.set({ [KEY]: tasks });
      return this.result(args.taskId, task);
    }

    try {
      const window = await chrome.windows.create({
        url: args.url || 'about:blank',
        incognito: true,
        focused: false,
      });
      const tab = window.tabs?.[0];
      if (!window.id || !tab?.id)
        return createErrorResponse('Chrome did not create an isolated task window.');
      const next: StoredTask = {
        windowId: window.id,
        tabId: tab.id,
        state: args.state || {},
        updatedAt: Date.now(),
      };
      tasks[args.taskId] = next;
      await chrome.storage.local.set({ [KEY]: tasks });
      return this.result(args.taskId, next);
    } catch (error) {
      return createErrorResponse(
        `Could not create an incognito task context. Enable “Allow in Incognito” for this extension first. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private result(taskId: string, task: StoredTask | null): ToolResult {
    return { content: [{ type: 'text', text: JSON.stringify({ taskId, task }) }], isError: false };
  }
}

export const taskContextTool = new TaskContextTool();
