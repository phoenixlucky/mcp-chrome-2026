import { z } from 'zod';

export const NATIVE_PROTOCOL_VERSION = 2 as const;
export const NATIVE_PROTOCOL_SUPPORTED_VERSIONS = [NATIVE_PROTOCOL_VERSION] as const;
export const NATIVE_CONNECTION_STATES = [
  'starting',
  'connected',
  'ready',
  'degraded',
  'stopped',
] as const;
export type NativeConnectionState = (typeof NATIVE_CONNECTION_STATES)[number];
export const NATIVE_PROTOCOL_ERROR_CODES = [
  'INVALID_REQUEST',
  'UNSUPPORTED_VERSION',
  'DEADLINE_EXCEEDED',
  'CANCELED',
  'NATIVE_DISCONNECTED',
  'QUEUE_FULL',
  'BROWSER_ERROR',
  'EXECUTION_UNKNOWN',
] as const;

export type NativeProtocolErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_VERSION'
  | 'DEADLINE_EXCEEDED'
  | 'CANCELED'
  | 'NATIVE_DISCONNECTED'
  | 'QUEUE_FULL'
  | 'BROWSER_ERROR'
  | 'EXECUTION_UNKNOWN';

const id = z.string().min(1);
const base = {
  version: z.literal(NATIVE_PROTOCOL_VERSION),
  traceId: id.optional(),
};

export const nativeRequestSchema = z
  .object({
    ...base,
    type: z.literal('request'),
    requestId: id,
    traceId: id,
    method: id,
    deadlineAt: z.number().finite().int(),
    idempotencyKey: id.optional(),
    params: z.unknown(),
  })
  .passthrough();

export const nativeResponseSchema = z
  .object({
    ...base,
    type: z.literal('response'),
    requestId: id,
    traceId: id,
    ok: z.boolean(),
    result: z.unknown().optional(),
    error: z
      .object({
        code: z.enum(NATIVE_PROTOCOL_ERROR_CODES),
        message: z.string(),
        details: z.unknown().optional(),
      })
      .optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.ok && value.error !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ok response cannot contain error' });
    }
    if (!value.ok && !value.error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'error response requires error' });
    }
  });

export const nativeEventSchema = z
  .object({
    ...base,
    type: z.literal('event'),
    requestId: id.optional(),
    event: id,
    data: z.unknown().optional(),
  })
  .passthrough();

export const nativeCancelSchema = z
  .object({
    ...base,
    type: z.literal('cancel'),
    requestId: id,
    reason: z.string().optional(),
  })
  .passthrough();

export const nativePingSchema = z
  .object({ ...base, type: z.literal('ping'), nonce: id.optional() })
  .passthrough();

export const nativePongSchema = z
  .object({ ...base, type: z.literal('pong'), nonce: id.optional() })
  .passthrough();

export const nativeHelloSchema = z
  .object({
    ...base,
    type: z.literal('hello'),
    supportedVersions: z.array(z.number().int().positive()).min(1),
    selectedVersion: z.number().int().positive().optional(),
    role: z.enum(['native-service', 'extension-background']),
    client: z.object({ name: id, version: id }).passthrough().optional(),
  })
  .passthrough();

export const nativeCapabilitiesSchema = z
  .object({
    ...base,
    type: z.literal('capabilities'),
    version: z.literal(NATIVE_PROTOCOL_VERSION),
    methods: z.array(id),
    events: z.array(id),
    features: z.array(id),
  })
  .passthrough();

export const nativeArtifactSchema = z
  .object({
    ...base,
    type: z.literal('artifact'),
    artifactId: id,
    contentType: id,
    size: z.number().finite().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    requestId: id.optional(),
    seq: z.number().int().nonnegative().optional(),
    eof: z.boolean().optional(),
    data: z.string().optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.data !== undefined && value.seq === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'artifact chunk requires seq' });
    }
    if (value.data !== undefined && value.eof === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'artifact chunk requires eof' });
    }
  });

export const nativeProtocolMessageSchema = z.union([
  nativeRequestSchema,
  nativeResponseSchema,
  nativeEventSchema,
  nativeCancelSchema,
  nativePingSchema,
  nativePongSchema,
  nativeHelloSchema,
  nativeCapabilitiesSchema,
  nativeArtifactSchema,
]);

export type NativeRequest = z.infer<typeof nativeRequestSchema>;
export type NativeResponse = z.infer<typeof nativeResponseSchema>;
export type NativeEvent = z.infer<typeof nativeEventSchema>;
export type NativeCancel = z.infer<typeof nativeCancelSchema>;
export type NativePing = z.infer<typeof nativePingSchema>;
export type NativePong = z.infer<typeof nativePongSchema>;
export type NativeHello = z.infer<typeof nativeHelloSchema>;
export type NativeCapabilities = z.infer<typeof nativeCapabilitiesSchema>;
export type NativeArtifact = z.infer<typeof nativeArtifactSchema>;
export type NativeProtocolMessage = z.infer<typeof nativeProtocolMessageSchema>;

export class NativeProtocolError extends Error {
  readonly code: NativeProtocolErrorCode;
  readonly details?: unknown;

  constructor(code: NativeProtocolErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'NativeProtocolError';
    this.code = code;
    this.details = details;
  }
}

export function parseNativeProtocolMessage(value: unknown): NativeProtocolMessage {
  if (!value || typeof value !== 'object') {
    throw new NativeProtocolError('INVALID_REQUEST', 'Protocol message must be an object');
  }
  const version = (value as { version?: unknown }).version;
  if (version !== NATIVE_PROTOCOL_VERSION) {
    throw new NativeProtocolError(
      'UNSUPPORTED_VERSION',
      `Unsupported protocol version: ${String(version)}`,
    );
  }
  const parsed = nativeProtocolMessageSchema.safeParse(value);
  if (!parsed.success) {
    throw new NativeProtocolError(
      'INVALID_REQUEST',
      'Invalid protocol message',
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}

export function validateNativeProtocolMessage(
  value: unknown,
): { success: true; data: NativeProtocolMessage } | { success: false; error: NativeProtocolError } {
  try {
    return { success: true, data: parseNativeProtocolMessage(value) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof NativeProtocolError
          ? error
          : new NativeProtocolError(
              'INVALID_REQUEST',
              error instanceof Error ? error.message : String(error),
            ),
    };
  }
}

export function negotiateNativeProtocolVersion(
  peerVersions: readonly number[],
  supportedVersions: readonly number[] = NATIVE_PROTOCOL_SUPPORTED_VERSIONS,
): number | null {
  return supportedVersions.find((version) => peerVersions.includes(version)) ?? null;
}

export function createNativeHello(
  role: NativeHello['role'],
  client: NativeHello['client'],
  traceId?: string,
): NativeHello {
  return {
    version: NATIVE_PROTOCOL_VERSION,
    type: 'hello',
    supportedVersions: [...NATIVE_PROTOCOL_SUPPORTED_VERSIONS],
    role,
    ...(client ? { client } : {}),
    ...(traceId ? { traceId } : {}),
  };
}

export const NATIVE_PROTOCOL_CAPABILITIES = {
  methods: [
    'browser.callTool',
    'browser.processData',
    'rr.listPublishedFlows',
    'rr.runFlow',
    'native.start',
    'native.stop',
    'file.operation',
  ],
  events: [
    'native.serverStarted',
    'native.serverStopped',
    'native.eventChannelReady',
    'tool.progress',
  ],
  features: [
    'abortSignal',
    'deadlines',
    'idempotency',
    'traceId',
    'singleResponse',
    'protocolNegotiation',
    'capabilityDiscovery',
    'artifactTransfer',
    'websocketEvents',
  ],
} as const;

export function createNativeCapabilities(traceId?: string): NativeCapabilities {
  return {
    version: NATIVE_PROTOCOL_VERSION,
    type: 'capabilities',
    methods: [...NATIVE_PROTOCOL_CAPABILITIES.methods],
    events: [...NATIVE_PROTOCOL_CAPABILITIES.events],
    features: [...NATIVE_PROTOCOL_CAPABILITIES.features],
    ...(traceId ? { traceId } : {}),
  };
}

export function createNativeResponse(
  request: Pick<NativeRequest, 'requestId' | 'traceId'>,
  result: unknown,
): NativeResponse {
  return {
    version: NATIVE_PROTOCOL_VERSION,
    type: 'response',
    requestId: request.requestId,
    traceId: request.traceId,
    ok: true,
    result,
  };
}

export function createNativeErrorResponse(
  request: Pick<NativeRequest, 'requestId' | 'traceId'>,
  error: NativeProtocolError,
): NativeResponse {
  return {
    version: NATIVE_PROTOCOL_VERSION,
    type: 'response',
    requestId: request.requestId,
    traceId: request.traceId,
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };
}

export function toNativeProtocolError(
  error: unknown,
  fallback: NativeProtocolErrorCode = 'BROWSER_ERROR',
) {
  if (error instanceof NativeProtocolError) return error;
  return new NativeProtocolError(fallback, error instanceof Error ? error.message : String(error));
}

/** JSON Schema for tooling and contract publication. Runtime validation uses the same Zod contract above. */
export const NATIVE_PROTOCOL_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Chrome MCP Native Messaging Protocol v2',
  oneOf: [
    { $ref: '#/$defs/request' },
    { $ref: '#/$defs/response' },
    { $ref: '#/$defs/event' },
    { $ref: '#/$defs/cancel' },
    { $ref: '#/$defs/ping' },
    { $ref: '#/$defs/pong' },
    { $ref: '#/$defs/hello' },
    { $ref: '#/$defs/capabilities' },
    { $ref: '#/$defs/artifact' },
  ],
  $defs: {
    base: {
      type: 'object',
      required: ['version'],
      properties: { version: { const: 2 }, traceId: { type: 'string', minLength: 1 } },
    },
    request: {
      type: 'object',
      required: ['version', 'type', 'requestId', 'traceId', 'method', 'deadlineAt', 'params'],
      properties: {
        version: { const: 2 },
        type: { const: 'request' },
        requestId: { type: 'string', minLength: 1 },
        traceId: { type: 'string', minLength: 1 },
        method: { type: 'string', minLength: 1 },
        deadlineAt: { type: 'integer' },
        idempotencyKey: { type: 'string', minLength: 1 },
        params: {},
      },
    },
    response: {
      type: 'object',
      required: ['version', 'type', 'requestId', 'traceId', 'ok'],
      properties: {
        version: { const: 2 },
        type: { const: 'response' },
        requestId: { type: 'string', minLength: 1 },
        traceId: { type: 'string', minLength: 1 },
        ok: { type: 'boolean' },
        result: {},
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { enum: [...NATIVE_PROTOCOL_ERROR_CODES] },
            message: { type: 'string' },
            details: {},
          },
        },
      },
    },
    event: {
      type: 'object',
      required: ['version', 'type', 'event'],
      properties: {
        version: { const: 2 },
        type: { const: 'event' },
        requestId: { type: 'string', minLength: 1 },
        traceId: { type: 'string', minLength: 1 },
        event: { type: 'string', minLength: 1 },
        data: {},
      },
    },
    cancel: {
      type: 'object',
      required: ['version', 'type', 'requestId'],
      properties: {
        version: { const: 2 },
        type: { const: 'cancel' },
        requestId: { type: 'string', minLength: 1 },
        traceId: { type: 'string', minLength: 1 },
        reason: { type: 'string' },
      },
    },
    ping: {
      type: 'object',
      required: ['version', 'type'],
      properties: {
        version: { const: 2 },
        type: { const: 'ping' },
        traceId: { type: 'string', minLength: 1 },
        nonce: { type: 'string', minLength: 1 },
      },
    },
    pong: {
      type: 'object',
      required: ['version', 'type'],
      properties: {
        version: { const: 2 },
        type: { const: 'pong' },
        traceId: { type: 'string', minLength: 1 },
        nonce: { type: 'string', minLength: 1 },
      },
    },
    hello: {
      type: 'object',
      required: ['version', 'type', 'supportedVersions', 'role'],
      properties: {
        version: { const: 2 },
        type: { const: 'hello' },
        traceId: { type: 'string', minLength: 1 },
        supportedVersions: { type: 'array', minItems: 1, items: { type: 'integer', minimum: 1 } },
        selectedVersion: { type: 'integer', minimum: 1 },
        role: { enum: ['native-service', 'extension-background'] },
        client: {
          type: 'object',
          required: ['name', 'version'],
          properties: {
            name: { type: 'string', minLength: 1 },
            version: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    capabilities: {
      type: 'object',
      required: ['version', 'type', 'methods', 'events', 'features'],
      properties: {
        version: { const: 2 },
        type: { const: 'capabilities' },
        traceId: { type: 'string', minLength: 1 },
        methods: { type: 'array', items: { type: 'string', minLength: 1 } },
        events: { type: 'array', items: { type: 'string', minLength: 1 } },
        features: { type: 'array', items: { type: 'string', minLength: 1 } },
      },
    },
    artifact: {
      type: 'object',
      required: ['version', 'type', 'artifactId', 'contentType', 'size', 'sha256'],
      properties: {
        version: { const: 2 },
        type: { const: 'artifact' },
        traceId: { type: 'string', minLength: 1 },
        requestId: { type: 'string', minLength: 1 },
        artifactId: { type: 'string', minLength: 1 },
        contentType: { type: 'string', minLength: 1 },
        size: { type: 'integer', minimum: 0 },
        sha256: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' },
        seq: { type: 'integer', minimum: 0 },
        eof: { type: 'boolean' },
        data: { type: 'string' },
      },
    },
  },
} as const;
