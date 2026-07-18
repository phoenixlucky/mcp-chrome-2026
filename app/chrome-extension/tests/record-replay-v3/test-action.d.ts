import type { JsonObject } from '@/entrypoints/background/record-replay/actions/types';

declare module '@/entrypoints/background/record-replay/actions/types' {
  interface ActionParamsByType {
    test: JsonObject;
  }
  interface ActionOutputsByType {
    test: JsonObject;
  }
}

export {};
