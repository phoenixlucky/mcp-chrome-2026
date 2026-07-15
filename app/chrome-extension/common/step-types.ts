// step-types.ts — re-export shared constants to keep single source of truth
export { STEP_TYPES } from '@ethanwilkins/chrome-mcp-shared-2026';
export type StepTypeConst =
  (typeof import('@ethanwilkins/chrome-mcp-shared-2026'))['STEP_TYPES'][keyof (typeof import('@ethanwilkins/chrome-mcp-shared-2026'))['STEP_TYPES']];
