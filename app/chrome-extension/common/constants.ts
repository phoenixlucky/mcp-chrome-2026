/**
 * Chrome Extension Constants
 * Centralized configuration values and magic constants
 */

// Native Host Configuration
export const NATIVE_HOST = {
  NAME: 'com.chromemcp.nativehost',
  DEFAULT_PORT: 12306,
} as const;

// Chrome Extension Icons
export const ICONS = {
  NOTIFICATION: 'icon/48.png',
} as const;

// Timeouts and Delays (in milliseconds)
export const TIMEOUTS = {
  DEFAULT_WAIT: 1000,
  NETWORK_CAPTURE_MAX: 30000,
  NETWORK_CAPTURE_IDLE: 3000,
  SCREENSHOT_DELAY: 100,
  KEYBOARD_DELAY: 50,
  CLICK_DELAY: 100,
} as const;

// Limits and Thresholds
export const LIMITS = {
  MAX_NETWORK_REQUESTS: 100,
  MAX_SEARCH_RESULTS: 50,
  MAX_BOOKMARK_RESULTS: 100,
  MAX_HISTORY_RESULTS: 100,
  SIMILARITY_THRESHOLD: 0.1,
  VECTOR_DIMENSIONS: 384,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NATIVE_CONNECTION_FAILED: 'Failed to connect to native host',
  NATIVE_DISCONNECTED: 'Native connection disconnected',
  SERVER_STATUS_LOAD_FAILED: 'Failed to load server status',
  SERVER_STATUS_SAVE_FAILED: 'Failed to save server status',
  TOOL_EXECUTION_FAILED: 'Tool execution failed',
  INVALID_PARAMETERS: 'Invalid parameters provided',
  PERMISSION_DENIED: 'Permission denied',
  TAB_NOT_FOUND: 'Tab not found',
  ELEMENT_NOT_FOUND: 'Element not found',
  NETWORK_ERROR: 'Network error occurred',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TOOL_EXECUTED: 'Tool executed successfully',
  CONNECTION_ESTABLISHED: 'Connection established',
  SERVER_STARTED: 'Server started successfully',
  SERVER_STOPPED: 'Server stopped successfully',
} as const;

// External Links
export const LINKS = {
  TROUBLESHOOTING:
    'https://github.com/phoenixlucky/mcp-chrome-2026/blob/master/docs/TROUBLESHOOTING.md',
} as const;

// Oxylabs Residential country targeting. The HTTP ports are the country
// entry points; the HTTPS ports are the corresponding sticky entry points.
export const PROXY_COUNTRIES = [
  { code: 'us', name: '美国', httpPort: 10000, httpsPort: 10001 },
  { code: 'ca', name: '加拿大', httpPort: 30000, httpsPort: 30001 },
  { code: 'mx', name: '墨西哥', httpPort: 10000, httpsPort: 10001 },
  { code: 'bs', name: '巴哈马', httpPort: 41000, httpsPort: 41001 },
  { code: 'bz', name: '伯利兹', httpPort: 42000, httpsPort: 42001 },
  { code: 'vg', name: '英属维尔京群岛', httpPort: 43000, httpsPort: 43001 },
  { code: 'cr', name: '哥斯达黎加', httpPort: 44000, httpsPort: 44001 },
  { code: 'cu', name: '古巴', httpPort: 45000, httpsPort: 45001 },
  { code: 'dm', name: '多米尼克', httpPort: 46000, httpsPort: 46001 },
  { code: 'ht', name: '海地', httpPort: 47000, httpsPort: 47001 },
  { code: 'hn', name: '洪都拉斯', httpPort: 48000, httpsPort: 48001 },
  { code: 'jm', name: '牙买加', httpPort: 49000, httpsPort: 49001 },
  { code: 'aw', name: '阿鲁巴', httpPort: 10000, httpsPort: 10001 },
  { code: 'pa', name: '巴拿马', httpPort: 11000, httpsPort: 11001 },
  { code: 'pr', name: '波多黎各', httpPort: 12000, httpsPort: 12001 },
  { code: 'tt', name: '特立尼达和多巴哥', httpPort: 13000, httpsPort: 13001 },
  { code: 'do', name: '多米尼加共和国', httpPort: 21000, httpsPort: 21001 },
  { code: 'br', name: '巴西', httpPort: 20000, httpsPort: 20001 },
] as const;

// File Extensions and MIME Types
export const FILE_TYPES = {
  STATIC_EXTENSIONS: [
    '.css',
    '.js',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
  ],
  FILTERED_MIME_TYPES: ['text/html', 'text/css', 'text/javascript', 'application/javascript'],
  IMAGE_FORMATS: ['png', 'jpeg', 'webp'] as const,
} as const;

// Network Filtering
export const NETWORK_FILTERS = {
  // Substring match against full URL (not just hostname) to support patterns like 'facebook.com/tr'
  EXCLUDED_DOMAINS: [
    // Google
    'google-analytics.com',
    'googletagmanager.com',
    'analytics.google.com',
    'doubleclick.net',
    'googlesyndication.com',
    'googleads.g.doubleclick.net',
    'stats.g.doubleclick.net',
    'adservice.google.com',
    'pagead2.googlesyndication.com',
    // Amazon
    'amazon-adsystem.com',
    // Microsoft
    'bat.bing.com',
    'clarity.ms',
    // Facebook
    'connect.facebook.net',
    'facebook.com/tr',
    // Twitter
    'analytics.twitter.com',
    'ads-twitter.com',
    // Other ad networks
    'ads.yahoo.com',
    'adroll.com',
    'adnxs.com',
    'criteo.com',
    'quantserve.com',
    'scorecardresearch.com',
    // Analytics & session recording
    'segment.io',
    'amplitude.com',
    'mixpanel.com',
    'optimizely.com',
    'static.hotjar.com',
    'script.hotjar.com',
    'crazyegg.com',
    'clicktale.net',
    'mouseflow.com',
    'fullstory.com',
    // LinkedIn (tracking pixels)
    'linkedin.com/px',
  ],
  // Static resource extensions (used when includeStatic=false)
  STATIC_RESOURCE_EXTENSIONS: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.svg',
    '.webp',
    '.ico',
    '.bmp',
    '.cur',
    '.css',
    '.scss',
    '.less',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.map',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.mp3',
    '.mp4',
    '.avi',
    '.mov',
    '.wmv',
    '.flv',
    '.webm',
    '.ogg',
    '.wav',
    '.pdf',
    '.zip',
    '.rar',
    '.7z',
    '.iso',
    '.dmg',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
  ],
  // MIME types treated as static/binary (filtered when includeStatic=false)
  STATIC_MIME_TYPES_TO_FILTER: [
    'image/',
    'font/',
    'audio/',
    'video/',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/x-javascript',
    'application/pdf',
    'application/zip',
    'application/octet-stream',
  ],
  // API-like MIME types (never filtered by MIME)
  API_MIME_TYPES: [
    'application/json',
    'application/xml',
    'text/xml',
    'text/plain',
    'text/event-stream',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/grpc',
    'application/protobuf',
    'application/x-protobuf',
    'application/x-json',
    'application/ld+json',
    'application/problem+json',
    'application/problem+xml',
    'application/soap+xml',
    'application/vnd.api+json',
  ],
  STATIC_RESOURCE_TYPES: ['stylesheet', 'image', 'font', 'media', 'other'],
} as const;

// Semantic Similarity Configuration
export const SEMANTIC_CONFIG = {
  DEFAULT_MODEL: 'sentence-transformers/all-MiniLM-L6-v2',
  CHUNK_SIZE: 512,
  CHUNK_OVERLAP: 50,
  BATCH_SIZE: 32,
  CACHE_SIZE: 1000,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  SERVER_STATUS: 'serverStatus',
  NATIVE_SERVER_PORT: 'nativeServerPort',
  NATIVE_AUTO_CONNECT_ENABLED: 'nativeAutoConnectEnabled',
  SEMANTIC_MODEL: 'selectedModel',
  USER_PREFERENCES: 'userPreferences',
  VECTOR_INDEX: 'vectorIndex',
  USERSCRIPTS: 'userscripts',
  USERSCRIPTS_DISABLED: 'userscripts_disabled',
  PROXY_CONFIG: 'proxyConfig',
  PROXY_SESSION_IDS: 'proxySessionIds',
  PROXY_TEST_RESULT: 'proxyTestResult',
  WEB_EDITOR_SEND_SCROLL_COORDINATES: 'webEditorSendScrollCoordinates',
  HIDDEN_INTERFACE_UNLOCKED: 'hiddenInterfaceUnlockedV2',
  // Record & Replay storage keys
  RR_FLOWS: 'rr_flows',
  RR_RUNS: 'rr_runs',
  RR_PUBLISHED: 'rr_published_flows',
  RR_SCHEDULES: 'rr_schedules',
  RR_TRIGGERS: 'rr_triggers',
  // Persistent recording state (guards resume across navigations/service worker restarts)
  RR_RECORDING_STATE: 'rr_recording_state',
} as const;

// Notification Configuration
export const NOTIFICATIONS = {
  PRIORITY: 2,
  TYPE: 'basic' as const,
} as const;

export enum ExecutionWorld {
  ISOLATED = 'ISOLATED',
  MAIN = 'MAIN',
}
