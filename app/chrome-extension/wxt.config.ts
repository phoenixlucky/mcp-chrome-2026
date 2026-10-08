import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { config } from 'dotenv';
import { resolve } from 'path';
import Icons from 'unplugin-icons/vite';
import Components from 'unplugin-vue-components/vite';
import IconsResolver from 'unplugin-icons/resolver';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const CHROME_EXTENSION_KEY = process.env.CHROME_EXTENSION_KEY;
// Detect dev mode early for manifest-level switches
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.MODE !== 'production';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  zip: {
    name: 'chrome-mcp-server',
  },
  webExt: {
    // Option 1: disable auto-start (recommended)
    disabled: true,

    // Option 2: to enable auto-start with an existing profile, uncomment the config below
    // chromiumArgs: [
    //   '--user-data-dir=' + homedir() + (process.platform === 'darwin'
    //     ? '/Library/Application Support/Google/Chrome'
    //     : process.platform === 'win32'
    //     ? '/AppData/Local/Google/Chrome/User Data'
    //     : '/.config/google-chrome'),
    //   '--remote-debugging-port=9222',
    // ],
  },
  manifest: {
    // Use environment variable for the key, fallback to undefined if not set
    key: CHROME_EXTENSION_KEY,
    default_locale: 'en',
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    permissions: [
      'nativeMessaging',
      'tabs',
      'activeTab',
      'scripting',
      'contextMenus',
      'downloads',
      'proxy',
      'webRequest',
      'webRequestAuthProvider',
      'webNavigation',
      'debugger',
      'history',
      'bookmarks',
      'cookies',
      'offscreen',
      'storage',
      'declarativeNetRequest',
      'alarms',
      // Allow programmatic control of Chrome Side Panel
      'sidePanel',
    ],
    host_permissions: ['<all_urls>'],
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'Catgirl Chrome MCP',
    },
    // Chrome Side Panel entry for workflow management
    // Ref: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
    side_panel: {
      default_path: 'sidepanel.html',
    },
    // Keyboard shortcuts for quick triggers
    commands: {
      // run_quick_trigger_1: {
      //   suggested_key: { default: 'Ctrl+Shift+1' },
      //   description: 'Run quick trigger 1',
      // },
      // run_quick_trigger_2: {
      //   suggested_key: { default: 'Ctrl+Shift+2' },
      //   description: 'Run quick trigger 2',
      // },
      // run_quick_trigger_3: {
      //   suggested_key: { default: 'Ctrl+Shift+3' },
      //   description: 'Run quick trigger 3',
      // },
      // open_workflow_sidepanel: {
      //   suggested_key: { default: 'Ctrl+Shift+O' },
      //   description: 'Open workflow sidepanel',
      // },
      toggle_web_editor: {
        description: 'Toggle Web Editor mode',
      },
      toggle_quick_panel: {
        description: 'Toggle Quick Panel AI Chat',
      },
      start_page_recording: {
        suggested_key: { default: 'Ctrl+Shift+1', mac: 'Command+Shift+1' },
        description: 'Start page recording',
      },
      toggle_page_recording_pause: {
        suggested_key: { default: 'Ctrl+Shift+2', mac: 'Command+Shift+2' },
        description: 'Pause or resume page recording',
      },
      stop_page_recording: {
        suggested_key: { default: 'Ctrl+Shift+3', mac: 'Command+Shift+3' },
        description: 'Stop page recording',
      },
    },
    web_accessible_resources: [
      {
        resources: [
          '/models/*', // allow access to all files under public/models/
          '/workers/*', // allow access to worker files
          '/inject-scripts/*', // helper files injected by content scripts
        ],
        matches: ['<all_urls>'],
      },
    ],
    // Note: the security policies below block dev server asset loading in development,
    // so they are only enabled in production; development relies on WXT's default policy.
    ...(IS_DEV
      ? {}
      : {
          cross_origin_embedder_policy: { value: 'require-corp' as const },
          cross_origin_opener_policy: { value: 'same-origin' as const },
          content_security_policy: {
            // Allow inline styles injected by Vite (compiled CSS) and data images used in UI thumbnails
            extension_pages:
              "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;",
          },
        }),
  },
  vite: (env) => ({
    plugins: [
      // TailwindCSS v4 Vite plugin – no PostCSS config required
      tailwindcss(),
      // Auto-register SVG icons as Vue components; all icons are bundled locally
      Components({
        dts: false,
        resolvers: [IconsResolver({ prefix: 'i', enabledCollections: ['lucide', 'mdi', 'ri'] })],
      }) as any,
      Icons({ compiler: 'vue3', autoInstall: false }) as any,
      // Ensure static assets are available as early as possible to avoid race conditions in dev
      // Copy workers/_locales/inject-scripts into the build output before other steps
      viteStaticCopy({
        targets: [
          {
            src: 'inject-scripts/*.js',
            dest: '.',
          },
          {
            src: [
              'workers/similarity.worker.js',
              'workers/ort-wasm-simd-threaded.mjs',
              'workers/ort-wasm-simd-threaded.wasm',
              'workers/simd_math.js',
              'workers/simd_math_bg.wasm',
            ],
            dest: '.',
          },
          {
            src: '_locales/**/*',
            // The source glob already contains the `_locales/` directory.
            // Copying into `_locales` would produce `_locales/_locales/...`,
            // which Chrome cannot use for extension localization.
            dest: '.',
          },
        ],
        // Use writeBundle so outDir exists for dev and prod
        hook: 'writeBundle',
        // Enable watch so changes to these files are reflected during dev
        watch: {
          // Use default patterns inferred from targets; explicit true enables watching
          // Vite plugin will watch src patterns and re-copy on change
        } as any,
      }) as any,
    ],
    resolve: {
      alias: {
        '@ethanwilkins/chrome-mcp-shared-2026': resolve(__dirname, '../../packages/shared/src'),
      },
    },
    build: {
      // Extension pages run in separate worlds; modulepreload entries cannot be reused across them.
      modulePreload: false,
      // Our build output must stay compatible with es6
      target: 'es2015',
      // Generate sourcemaps outside production
      sourcemap: env.mode !== 'production',
      // Keep development builds fast, but ship minified production bundles.
      reportCompressedSize: env.mode === 'production',
      // Warn when a chunk exceeds 1500kb
      chunkSizeWarningLimit: 1500,
      minify: env.mode === 'production' ? 'esbuild' : false,
    },
  }),
});
