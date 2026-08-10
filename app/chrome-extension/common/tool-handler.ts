import type { CallToolResult, TextContent, ImageContent } from '@modelcontextprotocol/sdk/types.js';

export interface ToolResult extends CallToolResult {
  content: (TextContent | ImageContent)[];
  isError: boolean;
}

export type ToolProgress = Record<string, unknown> & {
  phase?: string;
  completed?: number;
  total?: number;
  message?: string;
};

export type ToolProgressReporter = (progress: ToolProgress) => void | Promise<void>;

export interface ToolExecutor {
  execute(
    args: any,
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult>;
}

export const createErrorResponse = (
  message: string = 'Unknown error, please try again',
): ToolResult => {
  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError: true,
  };
};
