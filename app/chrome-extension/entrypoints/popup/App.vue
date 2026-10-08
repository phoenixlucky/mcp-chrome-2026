<template>
  <div
    :class="[
      'popup-container',
      'agent-theme',
      {
        'popup-container--home': currentView === 'home',
        'popup-container--premium': currentView !== 'home',
        'popup-container--unlocked': hiddenInterfaceUnlocked,
      },
    ]"
    :data-agent-theme="agentTheme"
  >
    <!-- Home -->
    <div v-show="currentView === 'home'" class="home-view">
      <div class="header">
        <div class="header-content">
          <div class="header-brand">
            <img class="header-brand-icon" src="/assets/brand/popup-mascot.png" alt="" />
            <div class="header-brand-copy">
              <h1 class="header-title">Catgirl Chrome MCP Server</h1>
              <p class="header-caption">CHROME MCP SERVER FOR ANYTHING</p>
            </div>
          </div>
          <button
            v-if="hiddenInterfaceUnlocked"
            type="button"
            class="header-logo-button"
            title="Open welcome page"
            aria-label="Open welcome page"
            @click="openWelcomePage"
          >
            <img class="header-logo" src="/assets/brand/popup-avatar.webp" alt="" />
          </button>
          <div v-else class="header-logo-button header-logo-button--hidden" aria-hidden="true">
            <img class="header-logo" src="/assets/brand/popup-avatar.webp" alt="" />
          </div>
        </div>
      </div>
      <div ref="homeContentRef" class="content">
        <!-- Service configuration card -->
        <div class="section">
          <h2 class="section-title">{{ getMessage('nativeServerConfigLabel') }}</h2>
          <p class="section-description">Quickly configure and manage your local MCP server</p>
          <div class="config-card">
            <div :class="['status-section', getStatusBgClass()]">
              <div :class="['status-banner', getStatusBgClass()]">
                <span :class="['status-symbol', getStatusBgClass()]"
                  ><PopupIcon name="bolt"
                /></span>
                <div class="status-copy">
                  <span class="status-label">{{ getMessage('runningStatusLabel') }}</span>
                  <strong class="status-text">{{ getStatusText() }}</strong>
                  <span class="status-description">
                    {{
                      serverStatus.isRunning
                        ? 'Everything is fine, serving clients'
                        : 'Connect the local service to expose MCP to clients'
                    }}
                  </span>
                </div>
                <div v-if="serverStatus.lastUpdated" class="status-meta">
                  <PopupIcon name="clock" />
                  <span>{{ getMessage('lastUpdatedLabel') }}</span>
                  <time>{{ new Date(serverStatus.lastUpdated).toLocaleTimeString() }}</time>
                </div>
                <button
                  class="refresh-status-button"
                  @click="refreshServerStatus"
                  :title="getMessage('refreshStatusButton')"
                >
                  <PopupIcon name="refresh" class="icon-small" />
                </button>
              </div>
              <div v-if="packageVersions" class="package-versions">
                <span>mcp-chrome-bridge-2026 v{{ packageVersions }}</span>
              </div>
            </div>

            <div
              v-if="nativeConnectionStatus === 'connected' && !serverStatus.isRunning"
              class="service-warning"
            >
              <div class="service-warning-icon">
                <PopupIcon name="warning" class="service-warning-icon-glyph" />
              </div>
              <div class="service-warning-body">
                <div class="service-warning-title">{{
                  getMessage('connectedServiceNotStartedStatus')
                }}</div>
                <div class="service-warning-desc">{{ getMessage('serviceNotStartedTip') }}</div>
                <div class="service-warning-actions">
                  <button class="service-warning-btn" @click="refreshServerStatus">
                    {{ getMessage('refreshStatusButton') }}
                  </button>
                  <button
                    class="service-warning-btn service-warning-btn-primary"
                    @click="startService"
                  >
                    {{ getMessage('startServiceButton') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="mcp-config-section">
              <div class="mcp-config-header">
                <div class="mcp-config-heading">
                  <PopupIcon name="server" />
                  <div>
                    <p class="mcp-config-label">{{ getMessage('mcpServerConfigLabel') }}</p>
                    <span>Pick a suitable config link and use it in your client</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="copy-config-button"
                  :aria-label="`Copy ${selectedMcpTransportOption.title} config`"
                  @click="copyMcpConfig"
                >
                  <PopupIcon name="copy" />
                  {{ copyButtonText }}
                </button>
              </div>
              <div
                class="mcp-transport-options"
                role="radiogroup"
                aria-label="MCP service endpoint"
              >
                <button
                  v-for="transport in mcpTransportOptions"
                  :key="transport.id"
                  type="button"
                  role="radio"
                  class="mcp-transport-option"
                  :class="{
                    'mcp-transport-option--selected': selectedMcpTransport === transport.id,
                    'mcp-transport-option--expanded': expandedMcpTransport === transport.id,
                  }"
                  :aria-checked="selectedMcpTransport === transport.id"
                  :aria-expanded="expandedMcpTransport === transport.id"
                  @click="selectedMcpTransport = transport.id"
                  @mouseenter="hoveredMcpTransport = transport.id"
                  @mouseleave="hoveredMcpTransport = null"
                  @focus="focusedMcpTransport = transport.id"
                  @blur="focusedMcpTransport = null"
                >
                  <span class="mcp-transport-option-icon">
                    <PopupIcon :name="transport.icon" />
                  </span>
                  <span class="mcp-transport-option-header">
                    <strong class="mcp-transport-option-title">{{ transport.title }}</strong>
                    <span
                      v-if="selectedMcpTransport === transport.id"
                      class="mcp-transport-option-selected"
                    >
                      Current
                    </span>
                  </span>
                  <code class="mcp-transport-option-endpoint">{{ transport.endpoint }}</code>
                  <span class="mcp-transport-option-description">{{ transport.description }}</span>
                  <PopupIcon name="chevron" class="mcp-transport-option-arrow" />
                </button>
              </div>
              <div class="mcp-config-content">
                <pre class="mcp-config-json">{{ mcpConfigJson }}</pre>
              </div>
            </div>

            <!-- Port and connection -->
            <div class="connection-group">
              <div class="port-section">
                <label for="port" class="port-label">{{ getMessage('connectionPortLabel') }}</label>
                <div class="port-input-wrapper">
                  <span class="port-prefix">127.0.0.1:</span>
                  <input
                    type="text"
                    id="port"
                    :value="nativeServerPort"
                    @input="updatePort"
                    class="port-input"
                  />
                </div>
              </div>

              <button class="connect-button" :disabled="isConnecting" @click="testNativeConnection">
                <PopupIcon name="bolt" />
                <span>{{
                  isConnecting
                    ? getMessage('connectingStatus')
                    : nativeConnectionStatus === 'connected'
                      ? getMessage('disconnectButton')
                      : getMessage('connectButton')
                }}</span>
              </button>
            </div>
            <section class="proxy-live-status" aria-live="polite">
              <div class="proxy-live-status-header">
                <strong>Current exit IP location</strong>
                <button
                  class="proxy-live-refresh"
                  type="button"
                  :disabled="!proxy.enabled || currentProxyInfoLoading"
                  :aria-busy="currentProxyInfoLoading"
                  @click="refreshCurrentProxyInfo"
                >
                  {{ currentProxyInfoLoading ? 'Fetching...' : 'Refresh' }}
                </button>
              </div>
              <p v-if="!proxy.enabled" class="proxy-live-placeholder">Proxy is disabled</p>
              <p
                v-else-if="currentProxyInfoLoading && !currentProxyInfo"
                class="proxy-live-placeholder"
              >
                Fetching current location...
              </p>
              <template v-else-if="currentProxyInfo">
                <p v-if="currentProxyLocation" class="proxy-live-location">{{
                  currentProxyLocation
                }}</p>
                <p v-else class="proxy-live-placeholder">No location data returned by the API</p>
                <code class="proxy-live-ip">{{ currentProxyInfo.ip }}</code>
              </template>
              <p v-else class="proxy-live-placeholder">
                {{ currentProxyInfoError || 'Unable to fetch the exit IP location right now' }}
              </p>
            </section>
            <div class="popup-subsection-heading">
              <PopupIcon name="sparkles" />
              <div>
                <strong>Settings / preferences</strong>
                <small>Customize extension behavior and preferences</small>
              </div>
            </div>
            <div class="extension-id">Extension ID: {{ extensionId }}</div>
            <label class="background-operations-switch">
              <span>
                <strong>Background operations</strong>
                <small>Open pages and run automation without stealing focus</small>
              </span>
              <input
                v-model="backgroundOperations"
                type="checkbox"
                @change="saveBackgroundOperations"
              />
            </label>
            <label class="background-operations-switch timeout-setting">
              <span>
                <strong>Page message timeout</strong>
                <small>Wait for content-script responses, default 30 s (5–300 s)</small>
              </span>
              <span class="timeout-input">
                <input
                  v-model.number="contentMessageTimeoutSeconds"
                  type="number"
                  min="5"
                  max="300"
                  step="1"
                  aria-label="Page message timeout (seconds)"
                  @change="saveContentMessageTimeout"
                />
                <small>s</small>
              </span>
            </label>
            <template v-if="hiddenInterfaceUnlocked">
              <label class="background-operations-switch">
                <span>
                  <strong>Send scroll coordinates</strong>
                  <small
                    >Show page X/Y coordinates in the overlay at the bottom-left of the page
                    editor</small
                  >
                </span>
                <input
                  v-model="sendScrollCoordinates"
                  type="checkbox"
                  @change="saveScrollCoordinatesSetting"
                />
              </label>
              <div class="popup-subsection-heading popup-subsection-heading--nested">
                <PopupIcon name="home" />
                <div>
                  <strong>Proxy settings</strong>
                  <small>Manage network proxy configuration</small>
                </div>
              </div>
              <label class="background-operations-switch">
                <span>
                  <strong>Residential proxy</strong>
                  <small>{{
                    proxy.enabled
                      ? 'Enabled, Chrome profile traffic goes through the proxy'
                      : 'Disabled'
                  }}</small>
                </span>
                <input
                  :checked="proxy.enabled"
                  :disabled="proxySaving"
                  type="checkbox"
                  @change="toggleProxy"
                />
              </label>
              <p v-if="proxyQuickResult" class="proxy-quick-result">{{ proxyQuickResult }}</p>
              <div class="proxy-quick-actions">
                <button
                  class="copy-config-button"
                  type="button"
                  :disabled="!proxy.enabled || proxySaving"
                  :aria-busy="proxyRotationPending"
                  @click="rotateCurrentProxy"
                >
                  {{
                    proxyRotationPending
                      ? 'Switching, please wait...'
                      : proxySaving
                        ? 'Processing...'
                        : 'Manually rotate the current page IP'
                  }}
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- Quick tools card -->
        <div class="section">
          <button
            type="button"
            class="section-title quick-tools-unlock-trigger"
            aria-label="Quick tools"
            @click="handleQuickToolsClick"
          >
            Quick tools
          </button>
          <div class="rr-icon-buttons">
            <button
              class="rr-icon-btn rr-icon-btn-edit has-tooltip"
              @click="toggleWebEditor"
              data-tooltip="Page editor: visually adjust elements and hand them to the assistant for edits"
            >
              <PopupIcon name="edit" />
              <span>Page editor</span>
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-marker has-tooltip"
              @click="toggleElementMarker"
              data-tooltip="Element markers: save key elements for MCP to read and the assistant to locate"
            >
              <PopupIcon name="tag" />
              <span>Element markers</span>
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-logs has-tooltip"
              @click="openErrorLogs"
              data-tooltip="View error logs"
            >
              <PopupIcon name="warning" />
              <span>Error logs</span>
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-record has-tooltip"
              :disabled="rrRecording"
              @click="startRecording"
              data-tooltip="Start recording (Ctrl+Shift+1)"
            >
              <PopupIcon name="record" />
              <span>Record</span>
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-pause has-tooltip"
              :disabled="!rrRecording"
              @click="togglePauseRecording"
              :data-tooltip="
                rrPaused ? 'Resume recording (Ctrl+Shift+2)' : 'Pause recording (Ctrl+Shift+2)'
              "
            >
              <PopupIcon name="pause" />
              <span>{{ rrPaused ? 'Resume' : 'Pause' }}</span>
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-stop has-tooltip"
              :disabled="!rrRecording"
              @click="stopRecording"
              data-tooltip="Stop recording (Ctrl+Shift+3)"
            >
              <PopupIcon name="stop" />
              <span>Stop</span>
            </button>
          </div>
          <p class="quick-tools-help"
            >The page editor is for visual adjustments and precise questions; element markers save
            key page elements for MCP and the assistant to reuse.</p
          >
          <p v-if="rrError" class="quick-tools-error">{{ rrError }}</p>
        </div>

        <!-- Management entry card -->
        <div v-if="hiddenInterfaceUnlocked" class="section">
          <h2 class="section-title">Management</h2>
          <div class="entry-card">
            <button class="entry-item" @click="openAgentSidepanel">
              <div class="entry-icon agent">
                <PopupIcon name="chat" />
              </div>
              <div class="entry-content">
                <span class="entry-title">AI assistant</span>
                <span class="entry-desc">AI Agent chat and tasks</span>
              </div>
              <PopupIcon name="chevron" class="entry-arrow" />
            </button>
            <button class="entry-item" @click="openWorkflowSidepanel">
              <div class="entry-icon workflow">
                <PopupIcon name="workflow" />
              </div>
              <div class="entry-content">
                <span class="entry-title"> Workflow management </span>
                <span class="entry-desc">Record and replay automation flows</span>
              </div>
              <PopupIcon name="chevron" class="entry-arrow" />
            </button>
            <button class="entry-item" @click="openElementMarkerSidepanel">
              <div class="entry-icon marker">
                <PopupIcon name="tag" />
              </div>
              <div class="entry-content">
                <span class="entry-title">Element marker management</span>
                <span class="entry-desc">Manage page element markers</span>
              </div>
              <PopupIcon name="chevron" class="entry-arrow" />
            </button>
            <button class="entry-item" @click="currentView = 'local-model'">
              <div class="entry-icon model">
                <PopupIcon name="server" />
              </div>
              <div class="entry-content">
                <span class="entry-title">Local models</span>
                <span class="entry-desc">Semantic engine and model management</span>
              </div>
              <PopupIcon name="chevron" class="entry-arrow" />
            </button>
            <button class="entry-item" @click="currentView = 'mcp-tools'">
              <div class="entry-icon tools">
                <PopupIcon name="grid" />
              </div>
              <div class="entry-content">
                <span class="entry-title">MCP tools overview</span>
                <span class="entry-desc">Browse available tools and parameters</span>
              </div>
              <PopupIcon name="chevron" class="entry-arrow" />
            </button>
            <button class="entry-item" @click="openProxySettings">
              <div class="entry-icon tools">
                <PopupIcon name="home" />
              </div>
              <div class="entry-content">
                <span class="entry-title">Residential proxy</span>
                <span class="entry-desc">Configure the proxy and auto-rotate on page errors</span>
              </div>
              <PopupIcon name="chevron" class="entry-arrow" />
            </button>
            <button class="entry-item" @click="openCookieManager">
              <div class="entry-icon tools">
                <PopupIcon name="cookie" />
              </div>
              <div class="entry-content">
                <span class="entry-title">Cookie manager</span>
                <span class="entry-desc">View and selectively clear cookies of all web tabs</span>
              </div>
              <PopupIcon name="chevron" class="entry-arrow" />
            </button>
            <button class="entry-item" @click="openRecentRecordedScripts">
              <div class="entry-icon recordings">
                <PopupIcon name="document" />
              </div>
              <div class="entry-content">
                <span class="entry-title">Recent recordings</span>
                <span class="entry-desc">Browse, open, or copy page recording flows</span>
              </div>
              <PopupIcon name="chevron" class="entry-arrow" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="hiddenInterfaceUnlocked" class="footer">
        <div class="footer-links">
          <button class="footer-link" @click="openWelcomePage" title="View installation guide">
            <PopupIcon name="info" />
            Guide
          </button>
          <button class="footer-link" @click="openTroubleshooting" title="Troubleshooting">
            <PopupIcon name="book" />
            Docs
          </button>
        </div>
        <p class="footer-text">chrome mcp server for anything</p>
      </div>
    </div>

    <div v-if="showErrorLogs" class="error-log-modal" @click.self="showErrorLogs = false">
      <section class="error-log-dialog" role="dialog" aria-modal="true" aria-label="Error logs">
        <header class="error-log-header">
          <strong>Error logs</strong>
          <button class="copy-config-button" @click="showErrorLogs = false">Close</button>
        </header>
        <textarea readonly class="error-log-content" :value="errorLogText"></textarea>
        <footer class="error-log-actions">
          <button class="copy-config-button" @click="copyErrorLogs">{{ errorLogCopyLabel }}</button>
          <button
            class="copy-config-button"
            :disabled="isExportingErrorLogs"
            @click="exportErrorLogs"
          >
            {{ isExportingErrorLogs ? 'Exporting...' : 'Export JSON' }}
          </button>
          <button class="copy-config-button" @click="clearErrorLogs">Clear logs</button>
        </footer>
      </section>
    </div>

    <div
      v-if="hiddenInterfaceUnlocked && showProxyModal"
      class="error-log-modal subpage-modal"
      @click.self="showProxyModal = false"
    >
      <section
        class="error-log-dialog proxy-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Residential proxy"
      >
        <header class="error-log-header">
          <strong>Residential proxy</strong>
          <button class="copy-config-button" @click="showProxyModal = false">Close</button>
        </header>
        <p class="proxy-description"
          >The reverse entry uses <code>pr.oxylabs.io:7777</code> + <code>cc-XX</code>;
          country-specific entries use the matching country host and port with
          <code>cc</code> omitted from the username. The extension keeps the same exit IP per site;
          without <code>sesstime</code> it defaults to about 5 minutes; add
          <code>sesstime-60</code> for longer stickiness.</p
        >
        <div class="proxy-form">
          <label class="proxy-toggle"
            ><span>Enable proxy</span><input v-model="proxy.enabled" type="checkbox"
          /></label>
          <label
            >Endpoint type<select v-model="proxy.endpointType"
              ><option value="reverse">Reverse entry (7777)</option
              ><option value="country">Country/region-specific entry</option></select
            ></label
          >
          <label v-if="proxy.endpointType === 'reverse'"
            >Access region<select v-model="proxy.accessRegion"
              ><option value="global">Global (pr.oxylabs.io:7777)</option
              ><option value="beijing">Beijing (cnt9t1is.com:8000)</option
              ><option value="hongkong">Hong Kong (a81298871.com:8000)</option
              ><option value="custom">Custom address</option></select
            ></label
          >
          <label
            >Output format / connection protocol<select v-model="proxy.protocol"
              ><option value="http">Endpoint: port / HTTP</option
              ><option value="https">HTTPS (required for Beijing/Hong Kong entries)</option
              ><option value="socks5" disabled
                >SOCKS5 (not supported by Oxylabs for Chrome)</option
              ></select
            ></label
          >
          <label
            >Proxy address or full connection string<input
              v-model="proxy.host"
              placeholder="customer-USER:PASSWORD@pr.oxylabs.io:7777"
          /></label>
          <label>Port<input v-model.number="proxy.port" type="number" min="1" max="65535" /></label>
          <label
            >Username<input v-model="proxy.username" placeholder="customer-USERNAME-cc-us"
          /></label>
          <label
            >Country/region{{ proxy.endpointType === 'country' ? '' : ' (optional)'
            }}<select v-model="proxy.countryCode"
              ><option v-if="proxy.endpointType === 'reverse'" value=""
                >Unspecified (keep username)</option
              ><option v-if="proxy.endpointType === 'reverse'" value="random"
                >Random (remove cc)</option
              ><option v-for="country in PROXY_COUNTRIES" :key="country.code" :value="country.code"
                >{{ country.name
                }}{{
                  proxy.endpointType === 'reverse'
                    ? `(cc-${country.code})`
                    : `(${country.code}-pr.oxylabs.io:${proxy.protocol === 'https' ? country.httpsPort : country.httpPort})`
                }}</option
              ></select
            ></label
          >
          <label
            >Password<input v-model="proxy.password" type="password" autocomplete="new-password"
          /></label>
          <label
            >Session ID (optional)<input v-model="proxy.sessionId" placeholder="0366443321"
          /></label>
          <label class="proxy-toggle"
            ><span>Auto-rotate IP on page errors (min. 5 minutes per site, no hourly cap)</span
            ><input v-model="proxy.rotateOnError" type="checkbox"
          /></label>
          <label
            >Only proxy these sites (leave empty for all sites)<textarea
              v-model="proxyDomains"
              rows="2"
              placeholder="example.com&#10;*.shop.example"
            />
          </label>
        </div>
        <p v-if="proxyResult" class="proxy-result">{{ proxyResult }}</p>
        <footer class="error-log-actions">
          <button
            class="copy-config-button"
            type="button"
            :disabled="proxySaving || !proxy.enabled"
            @click="rotateCurrentProxy"
            >Manually rotate IP</button
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="proxySaving"
            @click="() => saveProxySettings()"
            >Save</button
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="proxySaving"
            @click="testProxyConnection"
            >Test connection</button
          >
        </footer>
      </section>
    </div>

    <div
      v-if="hiddenInterfaceUnlocked && showProxyRotationResult"
      class="error-log-modal"
      @click.self="closeProxyRotationResult"
    >
      <section
        class="error-log-dialog proxy-rotation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proxy-rotation-result-title"
      >
        <header class="error-log-header">
          <strong id="proxy-rotation-result-title">IP rotated</strong>
          <button class="copy-config-button" type="button" @click="closeProxyRotationResult"
            >Close</button
          >
        </header>
        <div class="proxy-rotation-success" role="status" aria-live="polite">
          <span class="proxy-rotation-icon" aria-hidden="true">✓</span>
          <div class="proxy-rotation-copy">
            <strong>Current page IP updated</strong>
            <p>The current IP was rotated from the following address to:</p>
          </div>
        </div>
        <div class="proxy-ip-change" aria-label="IP before and after rotation">
          <div class="proxy-ip-item">
            <span class="proxy-ip-period">Before</span>
            <span
              v-if="formatProxyLocation(proxyRotationResult, 'previous')"
              class="proxy-ip-location"
              >{{ formatProxyLocation(proxyRotationResult, 'previous') }}</span
            >
            <code class="proxy-ip-value">{{
              proxyRotationResult?.previousIp || 'Fetch failed'
            }}</code>
          </div>
          <span class="proxy-ip-arrow" aria-hidden="true">→</span>
          <div class="proxy-ip-item">
            <span class="proxy-ip-period">After</span>
            <span
              v-if="formatProxyLocation(proxyRotationResult, 'current')"
              class="proxy-ip-location"
              >{{ formatProxyLocation(proxyRotationResult, 'current') }}</span
            >
            <code class="proxy-ip-value proxy-ip-value--current">{{
              proxyRotationResult?.currentIp || 'Fetch failed'
            }}</code>
          </div>
        </div>
        <p class="proxy-rotation-note">The current page is reloading, check back shortly.</p>
        <footer class="error-log-actions">
          <button class="copy-config-button" type="button" @click="closeProxyRotationResult"
            >Got it</button
          >
        </footer>
      </section>
    </div>

    <div v-if="showUnlockPrompt" class="error-log-modal" @click.self="closeUnlockPrompt">
      <section
        class="error-log-dialog unlock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-dialog-title"
      >
        <header class="error-log-header">
          <strong id="unlock-dialog-title">Unlock hidden interface</strong>
          <button class="copy-config-button" type="button" @click="closeUnlockPrompt"
            >Cancel</button
          >
        </header>
        <p class="unlock-description">
          {{
            unlockStep === 1
              ? 'Enter the first authorization passphrase.'
              : 'Enter the second authorization passphrase.'
          }}
        </p>
        <form class="unlock-form" @submit.prevent="unlockHiddenInterface">
          <input
            v-model="unlockPhrase"
            type="text"
            autocomplete="off"
            autofocus
            :placeholder="
              unlockStep === 1 ? 'Enter the first passphrase' : 'Enter the second passphrase'
            "
            :aria-label="
              unlockStep === 1
                ? 'First authorization passphrase'
                : 'Second authorization passphrase'
            "
          />
          <button class="copy-config-button unlock-submit" type="submit">
            {{ unlockStep === 1 ? 'Next' : 'Confirm unlock' }}
          </button>
        </form>
        <p v-if="unlockError" class="unlock-error" role="alert">{{ unlockError }}</p>
      </section>
    </div>

    <div
      v-if="hiddenInterfaceUnlocked && showCookieModal"
      class="error-log-modal subpage-modal"
      @click.self="showCookieModal = false"
    >
      <section
        class="error-log-dialog cookie-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Cookies of all tabs"
      >
        <header class="error-log-header">
          <strong>Cookies of all tabs</strong>
          <button class="copy-config-button" type="button" @click="showCookieModal = false"
            >Close</button
          >
        </header>
        <p class="proxy-description"
          >Select any web tab, then check the cookies to clear; unchecked cookies are kept. Only
          <code>http/https</code> web tabs are handled, and cookie values are not shown.</p
        >
        <div class="cookie-toolbar">
          <button
            class="copy-config-button"
            type="button"
            :disabled="cookieLoading || cookieSaving || !cookieCount"
            @click="selectAllCookies(true)"
            >Select all</button
          >
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="cookieLoading || cookieSaving"
            @click="selectAllCookies(false)"
            >Deselect all</button
          >
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="cookieLoading || cookieSaving || !cookieCount"
            @click="invertAllCookies"
            >Invert</button
          >
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="cookieLoading || cookieSaving"
            @click="loadAllCookieTabs"
            >Refresh</button
          >
          <span class="cookie-selected-count">Selected {{ selectedCookieCount }}</span>
        </div>
        <div v-if="cookieLoading" class="cookie-empty">Reading cookies from all web tabs...</div>
        <div v-else-if="!cookieTabs.length" class="cookie-empty"
          >No web tabs with readable cookies right now.</div
        >
        <div v-else class="cookie-tabs-list">
          <article v-for="tab in cookieTabs" :key="tab.id" class="cookie-tab-card">
            <div class="cookie-tab-header">
              <div class="cookie-tab-title">
                <strong>{{ tab.active ? 'Current' : 'Tab' }} · {{ tab.title || tab.url }}</strong>
                <span>{{ tab.url }}</span>
              </div>
              <div class="cookie-tab-actions">
                <button
                  class="copy-config-button"
                  type="button"
                  :disabled="tab.loading || cookieSaving || !tab.cookies.length"
                  @click="setTabCookiesSelected(tab, true)"
                  >Select all</button
                >
                >
                <button
                  class="copy-config-button"
                  type="button"
                  :disabled="tab.loading || cookieSaving || !tab.cookies.length"
                  @click="invertTabCookies(tab)"
                  >Invert</button
                >
                >
                <button
                  class="copy-config-button"
                  type="button"
                  :disabled="tab.loading || cookieSaving"
                  @click="loadCookiesForTab(tab)"
                  >Refresh</button
                >
              </div>
            </div>
            <p v-if="tab.loading" class="cookie-empty">Reading...</p>
            <p v-else-if="tab.error" class="cookie-error">{{ tab.error }}</p>
            <p v-else-if="!tab.cookies.length" class="cookie-empty">No matching cookies.</p>
            <div v-else class="cookie-list">
              <label v-for="entry in tab.cookies" :key="entry.key" class="cookie-row">
                <input v-model="entry.selected" type="checkbox" :disabled="cookieSaving" />
                <span class="cookie-info">
                  <strong>{{ entry.cookie.name }}</strong>
                  <small
                    >{{ entry.cookie.domain }}{{ entry.cookie.path }} ·
                    {{ entry.cookie.secure ? 'Secure' : 'Plain' }} ·
                    {{ entry.cookie.httpOnly ? 'HttpOnly' : 'Script-readable' }} ·
                    {{ entry.cookie.session ? 'Session' : 'Persistent' }}</small
                  >
                </span>
              </label>
            </div>
          </article>
        </div>
        <p v-if="cookieResult" class="proxy-result">{{ cookieResult }}</p>
        <footer class="error-log-actions">
          <button
            class="copy-config-button danger-action"
            type="button"
            :disabled="cookieSaving || !selectedCookieCount"
            @click="clearSelectedCookies"
            >{{ cookieSaving ? 'Clearing...' : `Clear selected ${selectedCookieCount}` }}</button
          >
          <button class="copy-config-button" type="button" @click="showCookieModal = false"
            >Cancel</button
          >
        </footer>
      </section>
    </div>

    <div
      v-if="hiddenInterfaceUnlocked && showRecentRecordedScripts"
      class="error-log-modal subpage-modal"
      @click.self="showRecentRecordedScripts = false"
    >
      <section
        class="error-log-dialog recent-scripts-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Recent recordings"
      >
        <header class="error-log-header">
          <strong>Recently recorded page scripts</strong>
          <button class="copy-config-button" @click="showRecentRecordedScripts = false"
            >Close</button
          >
        </header>
        <p v-if="recentRecordedFlows.length === 0" class="recent-scripts-empty"
          >No page recordings yet.</p
        >
        <div v-else class="recent-scripts-list">
          <article v-for="flow in recentRecordedFlows" :key="flow.id" class="recent-script-item">
            <div class="recent-script-info">
              <strong>{{ flow.name }}</strong>
              <span>{{ formatRecordedFlowTime(flow.updatedAt || flow.createdAt) }}</span>
            </div>
            <div class="recent-script-actions">
              <button class="copy-config-button" @click="openBuilderWindow(flow.id)">Open</button>
              <button class="copy-config-button" @click="runRecordedScript(flow.id)">Run</button>
              <button
                class="copy-config-button danger-action"
                @click="deleteRecordedScript(flow.id)"
                >Delete</button
              >
            </div>
          </article>
        </div>
        <p v-if="recentScriptsMessage" class="recent-scripts-message">{{ recentScriptsMessage }}</p>
      </section>
    </div>

    <!-- Local models subpage -->
    <LocalModelPage
      v-show="currentView === 'local-model'"
      :semantic-engine-status="semanticEngineStatus"
      :is-semantic-engine-initializing="isSemanticEngineInitializing"
      :semantic-engine-init-progress="semanticEngineInitProgress"
      :semantic-engine-last-updated="semanticEngineLastUpdated"
      :available-models="availableModels"
      :current-model="currentModel"
      :is-model-switching="isModelSwitching"
      :is-model-downloading="isModelDownloading"
      :model-download-progress="modelDownloadProgress"
      :model-initialization-status="modelInitializationStatus"
      :model-error-message="modelErrorMessage"
      :model-error-type="modelErrorType"
      :storage-stats="storageStats"
      :is-clearing-data="isClearingData"
      :clear-data-progress="clearDataProgress"
      :cache-stats="cacheStats"
      :is-managing-cache="isManagingCache"
      @back="currentView = 'home'"
      @initialize-semantic-engine="initializeSemanticEngine"
      @switch-model="switchModel"
      @retry-model-initialization="retryModelInitialization"
      @show-clear-confirmation="showClearConfirmation = true"
      @cleanup-cache="cleanupCache"
      @clear-all-cache="clearAllCache"
    />

    <McpToolsPage v-show="currentView === 'mcp-tools'" @back="currentView = 'home'" />

    <ConfirmDialog
      :visible="showClearConfirmation"
      :title="getMessage('confirmClearDataTitle')"
      :message="getMessage('clearDataWarningMessage')"
      :items="[
        getMessage('clearDataList1'),
        getMessage('clearDataList2'),
        getMessage('clearDataList3'),
      ]"
      :warning="getMessage('clearDataIrreversibleWarning')"
      icon="warning"
      :confirm-text="getMessage('confirmClearButton')"
      :cancel-text="getMessage('cancelButton')"
      :confirming-text="getMessage('clearingStatus')"
      :is-confirming="isClearingData"
      @confirm="confirmClearAllData"
      @cancel="hideClearDataConfirmation"
    />

    <!-- The sidepanel handles workflow management; the editor opens in a separate window -->

    <!-- Coming Soon Toast -->
    <Transition name="toast">
      <div v-if="comingSoonToast.show" class="coming-soon-toast">
        <PopupIcon name="clock" class="toast-icon" />
        <span>{{ comingSoonToast.feature }} is under development, stay tuned</span>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUpdate, onMounted, onUnmounted, onUpdated, reactive, ref } from 'vue';
import { getModelInfo, getCacheStats, clearModelCache } from '@/utils/semantic-similarity-engine';
import { cleanupModelCache } from '@/utils/model-cache-lifecycle';
import { PREDEFINED_MODELS, type ModelPreset } from '@/utils/semantic-models';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { WEB_EDITOR_V3_ACTIONS } from '@/common/web-editor-types';
import { LINKS, PROXY_COUNTRIES, STORAGE_KEYS } from '@/common/constants';
import { getMessage } from '@/utils/i18n';
import { useRRV3Rpc } from '@/entrypoints/shared/composables';
import { useAgentTheme, type AgentThemeId } from '../sidepanel/composables/useAgentTheme';

import PopupIcon from './components/PopupIcon.vue';
import type { PopupIconName } from './components/popup-icons';
import ConfirmDialog from './components/ConfirmDialog.vue';
import ProgressIndicator from './components/ProgressIndicator.vue';
import ModelCacheManagement from './components/ModelCacheManagement.vue';
import LocalModelPage from './components/LocalModelPage.vue';
import McpToolsPage from './components/McpToolsPage.vue';
// AgentChat theme - read from preload, kept consistent with the sidepanel
const { theme: agentTheme, initTheme } = useAgentTheme();
const rrRpc = useRRV3Rpc();

// Current view state: home or local models page
const currentView = ref<'home' | 'local-model' | 'mcp-tools'>('home');
const homeContentRef = ref<HTMLElement | null>(null);
let preservedHomeScrollTop = 0;

const UNLOCK_CLICK_LIMIT = 10;
const UNLOCK_HASH_SALT = 'rr-hidden-interface-v1';
const UNLOCK_PRIMARY_DIGESTS = new Set([
  '42dbccba93577cbeb7db3bddee95dccfaa5328fbd93dccea4bbe717dccbaefce',
  '17889b8101b7aae9f29f4945b38f3869c9511e8acf80ab101b644973a1023a09',
]);
const UNLOCK_SECONDARY_DIGEST = '235284192023e02236e7d9886b14e7745e43587ed584e547c94eadebe4ad0794';
const hiddenInterfaceUnlocked = ref(false);
const quickToolsClickCount = ref(0);
const showUnlockPrompt = ref(false);
const unlockStep = ref<1 | 2>(1);
const unlockPhrase = ref('');
const unlockError = ref('');

async function loadHiddenInterfaceState() {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.HIDDEN_INTERFACE_UNLOCKED);
    hiddenInterfaceUnlocked.value = stored[STORAGE_KEYS.HIDDEN_INTERFACE_UNLOCKED] === true;
  } catch (error) {
    console.warn('Failed to load hidden interface state:', error);
  }
}

function handleQuickToolsClick() {
  if (hiddenInterfaceUnlocked.value) return;
  quickToolsClickCount.value += 1;
  if (quickToolsClickCount.value < UNLOCK_CLICK_LIMIT) return;

  quickToolsClickCount.value = 0;
  unlockStep.value = 1;
  unlockPhrase.value = '';
  unlockError.value = '';
  showUnlockPrompt.value = true;
}

function closeUnlockPrompt() {
  showUnlockPrompt.value = false;
  unlockStep.value = 1;
  unlockPhrase.value = '';
  unlockError.value = '';
}

async function hashUnlockPhrase(phrase: string): Promise<string> {
  const encoded = new TextEncoder().encode(UNLOCK_HASH_SALT + phrase);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function unlockHiddenInterface() {
  try {
    const phraseDigest = await hashUnlockPhrase(unlockPhrase.value.trim());

    if (unlockStep.value === 1) {
      if (!UNLOCK_PRIMARY_DIGESTS.has(phraseDigest)) {
        unlockError.value = 'Incorrect first passphrase, please retry.';
        return;
      }

      unlockStep.value = 2;
      unlockPhrase.value = '';
      unlockError.value = '';
      return;
    }

    if (phraseDigest !== UNLOCK_SECONDARY_DIGEST) {
      unlockError.value = 'Incorrect second passphrase, please retry.';
      return;
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.HIDDEN_INTERFACE_UNLOCKED]: true });
    hiddenInterfaceUnlocked.value = true;
    closeUnlockPrompt();
  } catch (error) {
    console.warn('Failed to verify or save hidden interface state:', error);
    unlockError.value = 'Verification failed, please retry later.';
  }
}

onBeforeUpdate(() => {
  const content = homeContentRef.value;
  if (content) {
    preservedHomeScrollTop = content.scrollTop;
  }
});

onUpdated(() => {
  const content = homeContentRef.value;
  if (content && content.scrollTop !== preservedHomeScrollTop) {
    content.scrollTop = preservedHomeScrollTop;
  }
});

const showErrorLogs = ref(false);
const showProxyModal = ref(false);
const proxySaving = ref(false);
const proxyRotationPending = ref(false);
const proxyResult = ref('');
const proxyQuickResult = ref('');
const showProxyRotationResult = ref(false);
const proxyRotationResult = ref<{
  previousIp?: string;
  currentIp?: string;
  previousCountry?: string;
  currentCountry?: string;
  previousRegion?: string;
  currentRegion?: string;
  previousCity?: string;
  currentCity?: string;
  previousLocation?: string;
  currentLocation?: string;
} | null>(null);
const currentProxyInfo = ref<{
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  location?: string;
} | null>(null);
const currentProxyInfoLoading = ref(false);
const currentProxyInfoError = ref('');
let currentProxyInfoRequestId = 0;
const currentProxyLocation = computed(() =>
  currentProxyInfo.value
    ? joinProxyLocation(
        currentProxyInfo.value.country,
        currentProxyInfo.value.region,
        currentProxyInfo.value.city,
        currentProxyInfo.value.location,
      )
    : '',
);
const proxyDomains = ref('');
const proxy = reactive({
  enabled: false,
  host: '',
  port: 7777,
  username: '',
  password: '',
  sessionId: '',
  rotateOnError: true,
  countryCode: '',
  endpointType: 'reverse' as 'reverse' | 'country',
  accessRegion: 'global' as 'global' | 'beijing' | 'hongkong' | 'custom',
  protocol: 'http' as 'http' | 'https' | 'socks5',
});
type CookieSelection = {
  cookie: chrome.cookies.Cookie;
  key: string;
  selected: boolean;
};
type CookieTabState = {
  id: number;
  title: string;
  url: string;
  active: boolean;
  storeId?: string;
  loading: boolean;
  error: string;
  cookies: CookieSelection[];
};
const showCookieModal = ref(false);
const cookieLoading = ref(false);
const cookieSaving = ref(false);
const cookieResult = ref('');
const cookieTabs = ref<CookieTabState[]>([]);
const cookieCount = computed(() =>
  cookieTabs.value.reduce((total, tab) => total + tab.cookies.length, 0),
);
const selectedCookieCount = computed(() =>
  cookieTabs.value.reduce(
    (total, tab) => total + tab.cookies.filter((entry) => entry.selected).length,
    0,
  ),
);
const isExportingErrorLogs = ref(false);
const errorLogCopyLabel = ref('Copy logs');
const errorLogs = ref<Array<{ timestamp: string; type: string; message: string; stack?: string }>>(
  [],
);
const errorLogText = computed(() =>
  errorLogs.value.length
    ? errorLogs.value
        .map(
          (log) =>
            `[${formatRecordedFlowTime(log.timestamp)}] ${log.type}: ${log.message}${log.stack ? `\n${log.stack}` : ''}`,
        )
        .join('\n\n')
    : 'No error logs yet.',
);

async function loadErrorLogs() {
  const response = await chrome.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.GET_ERROR_LOGS,
  });
  errorLogs.value = response?.success && Array.isArray(response.logs) ? response.logs : [];
}

async function openErrorLogs() {
  showErrorLogs.value = true;
  await loadErrorLogs();
}

async function exportErrorLogs() {
  if (isExportingErrorLogs.value) return;
  isExportingErrorLogs.value = true;
  try {
    await loadErrorLogs();
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), logs: errorLogs.value }, null, 2)],
        {
          type: 'application/json',
        },
      ),
    );
    await chrome.downloads.download({
      url,
      filename: `mcp-chrome-errors-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      saveAs: true,
    });
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } finally {
    isExportingErrorLogs.value = false;
  }
}

async function copyErrorLogs() {
  try {
    await navigator.clipboard.writeText(errorLogText.value);
    errorLogCopyLabel.value = 'Copied';
  } catch {
    errorLogCopyLabel.value = 'Copy failed';
  }
  setTimeout(() => (errorLogCopyLabel.value = 'Copy logs'), 1500);
}

async function clearErrorLogs() {
  await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.CLEAR_ERROR_LOGS });
  errorLogs.value = [];
}

// Coming Soon Toast
const comingSoonToast = ref<{ show: boolean; feature: string }>({ show: false, feature: '' });

function showComingSoonToast(feature: string) {
  comingSoonToast.value = { show: true, feature };
  setTimeout(() => {
    comingSoonToast.value = { show: false, feature: '' };
  }, 2000);
}

// Record & Replay state
const rrRecording = ref(false);
const rrPaused = ref(false);
const rrError = ref('');
const rrFlows = ref<
  Array<{
    id: string;
    name: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    meta?: any;
    variables?: any[];
  }>
>([]);
const showRecentRecordedScripts = ref(false);
const recentScriptsMessage = ref('');
const rrOnlyBound = ref(false);
const rrSearch = ref('');
const currentTabUrl = ref<string>('');
const recentRecordedFlows = computed(() =>
  rrFlows.value
    .filter(
      (flow) =>
        flow.meta?.tags?.includes('Page recording') ||
        flow.meta?.tags?.includes('页面录制') ||
        flow.description?.startsWith('Recorded from ') ||
        flow.description?.startsWith('录制自 '), // legacy flows recorded before the anglicization
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    )
    .slice(0, 10),
);
const filteredRrFlows = computed(() => {
  const base = rrOnlyBound.value ? rrFlows.value.filter(isFlowBoundToCurrent) : rrFlows.value;
  const q = rrSearch.value.trim().toLowerCase();
  if (!q) return base;
  return base.filter((f: any) => {
    const name = String(f.name || '').toLowerCase();
    const domain = String(f?.meta?.domain || '').toLowerCase();
    const tags = ((f?.meta?.tags || []) as any[]).join(',').toLowerCase();
    return name.includes(q) || domain.includes(q) || tags.includes(q);
  });
});

// The Flow editor opens in a separate window; the popup no longer shows a long list

const loadFlows = async () => {
  try {
    const res = await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.RR_LIST_FLOWS });
    if (res && res.success) rrFlows.value = res.flows || [];
  } catch (e) {
    /* ignore */
  }
};

async function openRecentRecordedScripts() {
  recentScriptsMessage.value = '';
  await loadFlows();
  showRecentRecordedScripts.value = true;
}

async function runRecordedScript(flowId: string) {
  try {
    await rrRpc.ensureConnected();
    await rrRpc.request('rr_v3.enqueueRun', { flowId });
    recentScriptsMessage.value = 'Started running the recorded script.';
  } catch (error) {
    recentScriptsMessage.value =
      error instanceof Error ? error.message : 'Failed to run the script.';
  }
}

async function deleteRecordedScript(flowId: string) {
  if (!window.confirm('Delete this recorded script? This cannot be undone.')) return;
  try {
    await rrRpc.ensureConnected();
    await rrRpc.request('rr_v3.deleteFlow', { flowId });
    recentScriptsMessage.value = 'Recorded script deleted.';
    await loadFlows();
  } catch (error) {
    recentScriptsMessage.value =
      error instanceof Error ? error.message : 'Failed to delete the script.';
  }
}

function formatRecordedFlowTime(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Unknown time';
}

async function startRecording() {
  try {
    const result = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.RR_START_RECORDING,
    });
    if (!result?.success) {
      rrError.value = result?.error || 'Recording operation failed';
      return;
    }
    rrError.value = '';
    rrRecording.value = true;
    rrPaused.value = false;
  } catch (error) {
    rrError.value = error instanceof Error ? error.message : 'Cannot reach the recording service';
  }
}

async function togglePauseRecording() {
  const result = await chrome.runtime.sendMessage({
    type: rrPaused.value
      ? BACKGROUND_MESSAGE_TYPES.RR_RESUME_RECORDING
      : BACKGROUND_MESSAGE_TYPES.RR_PAUSE_RECORDING,
  });
  if (!result?.success) return console.warn(result?.error || 'Recording operation failed');
  rrPaused.value = !rrPaused.value;
}

async function stopRecording() {
  const result = await chrome.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.RR_STOP_RECORDING,
  });
  if (!result?.success) return console.warn(result?.error || 'Failed to stop recording');
  rrRecording.value = false;
  rrPaused.value = false;
  await loadFlows();
  if (result.flow?.id) openBuilderWindow(result.flow.id);
}

function isFlowBoundToCurrent(flow: any) {
  try {
    const bindings = flow?.meta?.bindings || [];
    if (!bindings.length) return false;
    if (!currentTabUrl.value) return true;
    const url = new URL(currentTabUrl.value);
    return bindings.some((b: any) => {
      if (b.type === 'domain') return url.hostname.includes(b.value);
      if (b.type === 'path') return url.pathname.startsWith(b.value);
      if (b.type === 'url') return (url.href || '').startsWith(b.value);
      return false;
    });
  } catch {
    return false;
  }
}

const runFlow = async (flowId: string) => {
  try {
    // load flow to get runOptions
    let flow: any = null;
    try {
      const getRes = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.RR_GET_FLOW,
        flowId,
      });
      if (getRes && getRes.success) flow = getRes.flow;
    } catch {}
    const runOptions = (flow && flow.meta && flow.meta.runOptions) || {};
    // No per-run overrides in popup; sidepanel/editor manage advanced options
    const ov: any = {};
    const res = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.RR_RUN_FLOW,
      flowId,
      options: { ...runOptions, ...ov, returnLogs: true },
    });
    if (!(res && res.success)) {
      console.warn('Replay failed');
      return;
    }
    // If failed, open builder and focus the failed node
    try {
      const result = res.result;
      if (result && result.success === false) {
        const logs = result.logs || [];
        const failed = logs.find((l: any) => l.status === 'failed');
        if (failed && failed.stepId) {
          // Open the standalone editor window and focus the failed node
          if (flow) openBuilderWindow(flow.id, String(failed.stepId));
        }
      } else if (result && result.success === true) {
        // If run succeeded but selector fallback was used, suggest updating priorities
        const logs = result.logs || [];
        const fb = logs.find((l: any) => l.fallbackUsed && l.fallbackTo);
        if (fb && flow) openBuilderWindow(flow.id, String(fb.stepId || ''));
      }
    } catch {}
  } catch (e) {
    console.error('Replay failed:', e);
  }
};

// Legacy clone/publish/schedule/override items are handled in the sidepanel or editor

const nativeConnectionStatus = ref<'unknown' | 'connected' | 'disconnected'>('unknown');
const isConnecting = ref(false);
const nativeServerPort = ref<number>(12306);
const backgroundOperations = ref(true);
const contentMessageTimeoutSeconds = ref(30);
const sendScrollCoordinates = ref(false);
const extensionId = chrome.runtime.id;
const serverStatus = ref<{
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}>({
  isRunning: false,
  lastUpdated: Date.now(),
});
const packageVersions = ref<string | null>(null);

const copyButtonText = ref(getMessage('copyConfigButton'));

type McpTransportId = 'streamable-http' | 'streamable-http-new' | 'sse' | 'stdio';

type McpTransportOption = {
  id: McpTransportId;
  icon: PopupIconName;
  title: string;
  endpoint: string;
  description: string;
  config: Record<string, unknown>;
};

const selectedMcpTransport = ref<McpTransportId>('streamable-http-new');
const hoveredMcpTransport = ref<McpTransportId | null>(null);
const focusedMcpTransport = ref<McpTransportId | null>(null);
const expandedMcpTransport = computed(
  () => hoveredMcpTransport.value ?? focusedMcpTransport.value ?? selectedMcpTransport.value,
);

const mcpTransportOptions = computed<McpTransportOption[]>(() => {
  const port = serverStatus.value.port || nativeServerPort.value;
  const baseUrl = `http://127.0.0.1:${port}`;

  return [
    {
      id: 'streamable-http',
      icon: 'globe',
      title: 'Streamable HTTP (compatible)',
      endpoint: `${baseUrl}/mcp`,
      description: 'Keeps sessions, compatible with existing clients',
      config: {
        mcpServers: {
          'streamable-mcp-server': {
            type: 'streamable-http',
            url: `${baseUrl}/mcp`,
          },
        },
      },
    },
    {
      id: 'streamable-http-new',
      icon: 'rocket',
      title: 'Streamable HTTP (preview)',
      endpoint: `${baseUrl}/mcp-new`,
      description: 'MCP 2026-07-28, sessionless',
      config: {
        mcpServers: {
          'streamable-mcp-server-new': {
            type: 'streamable-http',
            url: `${baseUrl}/mcp-new`,
          },
        },
      },
    },
    {
      id: 'sse',
      icon: 'share',
      title: 'SSE (legacy MCP)',
      endpoint: `${baseUrl}/sse`,
      description: 'Message endpoint: /messages?sessionId=...',
      config: {
        mcpServers: {
          'sse-mcp-server': {
            url: `${baseUrl}/sse`,
          },
        },
      },
    },
    {
      id: 'stdio',
      icon: 'server',
      title: 'STDIO',
      endpoint: 'mcp-chrome-stdio or EXE --stdio',
      description: 'Connects to /mcp-new first, falls back to /mcp on failure',
      config: {
        mcpServers: {
          'chrome-mcp-stdio': {
            command: 'mcp-chrome-stdio',
            env: {
              MCP_SERVER_URL: `${baseUrl}/mcp-new`,
            },
          },
        },
      },
    },
  ];
});

const selectedMcpTransportOption = computed<McpTransportOption>(() => {
  return (
    mcpTransportOptions.value.find(({ id }) => id === selectedMcpTransport.value) ??
    mcpTransportOptions.value[0]
  );
});

const mcpConfigJson = computed(() => {
  return JSON.stringify(selectedMcpTransportOption.value.config, null, 2);
});

const currentModel = ref<ModelPreset | null>(null);
const isModelSwitching = ref(false);
const modelSwitchProgress = ref('');

const modelDownloadProgress = ref<number>(0);
const isModelDownloading = ref(false);
const modelInitializationStatus = ref<'idle' | 'downloading' | 'initializing' | 'ready' | 'error'>(
  'idle',
);
const modelErrorMessage = ref<string>('');
const modelErrorType = ref<'network' | 'file' | 'unknown' | ''>('');

const selectedVersion = ref<'quantized'>('quantized');

const storageStats = ref<{
  indexedPages: number;
  totalDocuments: number;
  totalTabs: number;
  indexSize: number;
  isInitialized: boolean;
} | null>(null);
const isRefreshingStats = ref(false);
const isClearingData = ref(false);
const showClearConfirmation = ref(false);
const clearDataProgress = ref('');

const semanticEngineStatus = ref<'idle' | 'initializing' | 'ready' | 'error'>('idle');
const isSemanticEngineInitializing = ref(false);
const semanticEngineInitProgress = ref('');
const semanticEngineLastUpdated = ref<number | null>(null);

// Cache management
const isManagingCache = ref(false);
const cacheStats = ref<{
  totalSize: number;
  totalSizeMB: number;
  entryCount: number;
  entries: Array<{
    url: string;
    size: number;
    sizeMB: number;
    timestamp: number;
    age: string;
    expired: boolean;
  }>;
} | null>(null);

const availableModels = computed(() => {
  return Object.entries(PREDEFINED_MODELS).map(([key, value]) => ({
    preset: key as ModelPreset,
    ...value,
  }));
});

const getStatusDotClass = () => {
  if (nativeConnectionStatus.value === 'connected') {
    if (serverStatus.value.isRunning) {
      return 'dot-green';
    } else {
      return 'dot-yellow';
    }
  } else if (nativeConnectionStatus.value === 'disconnected') {
    return 'dot-red';
  } else {
    return 'dot-gray';
  }
};

const getStatusBgClass = () => {
  if (nativeConnectionStatus.value === 'connected') {
    if (serverStatus.value.isRunning) {
      return 'bg-green-subtle';
    } else {
      return 'bg-yellow-subtle';
    }
  } else if (nativeConnectionStatus.value === 'disconnected') {
    return 'bg-red-subtle';
  } else {
    return 'bg-gray-subtle';
  }
};

// Open sidepanel and close popup
async function openSidepanelAndClose(tab: string) {
  try {
    const current = await chrome.windows.getCurrent();
    if ((chrome.sidePanel as any)?.setOptions) {
      await (chrome.sidePanel as any).setOptions({
        path: `sidepanel.html?tab=${tab}`,
        enabled: true,
      });
    }
    if (chrome.sidePanel && (chrome.sidePanel as any).open) {
      await (chrome.sidePanel as any).open({ windowId: current.id! });
    }
    // Close popup after opening sidepanel
    window.close();
  } catch (e) {
    console.warn(`Failed to open sidepanel (${tab}):`, e);
  }
}

// Open sidepanel from popup for workflow management
function openWorkflowSidepanel() {
  openSidepanelAndClose('workflows');
}

// Open sidepanel for element marker management
function openElementMarkerSidepanel() {
  openSidepanelAndClose('element-markers');
}

// Open sidepanel for agent chat
function openAgentSidepanel() {
  openSidepanelAndClose('agent-chat');
}

async function loadProxySettings() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.PROXY_CONFIG,
    STORAGE_KEYS.PROXY_TEST_RESULT,
  ]);
  const saved = stored[STORAGE_KEYS.PROXY_CONFIG] || {};
  Object.assign(proxy, saved);
  if (!Object.hasOwn(saved, 'countryCode')) {
    proxy.countryCode = saved.username?.match(/-cc-([a-z]{2})(?=-|$)/i)?.[1] || '';
  }
  proxyDomains.value = (saved.domains || []).join('\n');
  const test = stored[STORAGE_KEYS.PROXY_TEST_RESULT] as
    | {
        success?: boolean;
        pending?: boolean;
        ip?: string;
        country?: string;
        region?: string;
        city?: string;
        location?: string;
        error?: string;
      }
    | undefined;
  if (test?.success && test.ip) {
    currentProxyInfo.value = {
      ip: test.ip,
      country: test.country,
      region: test.region,
      city: test.city,
      location: test.location,
    };
  }
  if (test?.pending) {
    proxyResult.value = 'Testing proxy exit...';
  } else if (test?.success && test.ip) {
    proxyResult.value = `Connected, exit IP: ${test.ip}${test.country ? ` (country/region: ${test.country})` : ''}`;
  } else if (test?.error) {
    proxyResult.value = `Error: ${test.error}`;
  }
}

async function saveProxySettings(showResult = true): Promise<boolean> {
  proxySaving.value = true;
  proxyResult.value = '';
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'proxy_configure',
      config: {
        ...proxy,
        domains: proxyDomains.value
          .split(/[\n,]/)
          .map((domain) => domain.trim())
          .filter(Boolean),
      },
    });
    if (!response?.success) throw new Error(response?.error || 'Save failed');
    Object.assign(proxy, response.config);
    proxyDomains.value = (response.config.domains || []).join('\n');
    if (showResult) proxyResult.value = proxy.enabled ? 'Proxy enabled' : 'Proxy disabled';
    if (showResult && proxy.enabled) void refreshCurrentProxyInfo();
    else if (showResult) currentProxyInfo.value = null;
    return true;
  } catch (error: any) {
    proxyResult.value = `Error: ${error?.message || String(error)}`;
    return false;
  } finally {
    proxySaving.value = false;
  }
}

async function testProxyConnection() {
  proxyResult.value = 'Testing proxy exit...';
  if (!(await saveProxySettings(false))) return;
  proxySaving.value = true;
  proxyResult.value = 'Testing proxy exit...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const response = await chrome.runtime.sendMessage({ type: 'proxy_test', tabId: tab?.id });
    if (!response?.success) throw new Error(response?.error || 'Test failed');
    currentProxyInfo.value = {
      ip: response.ip,
      country: response.country,
      region: response.region,
      city: response.city,
      location: response.location,
    };
    currentProxyInfoError.value = '';
    proxyResult.value = `Connected, exit IP: ${response.ip}${response.country ? ` (country/region: ${response.country})` : ''}`;
  } catch (error: any) {
    proxyResult.value = `Error: ${error?.message || String(error)}`;
  } finally {
    proxySaving.value = false;
  }
}

async function refreshCurrentProxyInfo() {
  const requestId = ++currentProxyInfoRequestId;
  currentProxyInfoError.value = '';
  if (!proxy.enabled) {
    currentProxyInfo.value = null;
    currentProxyInfoLoading.value = false;
    return;
  }

  currentProxyInfoLoading.value = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) throw new Error('No web tab available to query');
    const response = await chrome.runtime.sendMessage({ type: 'proxy_test', tabId: tab.id });
    if (!response?.success) throw new Error(response?.error || 'Location lookup failed');
    if (requestId !== currentProxyInfoRequestId) return;
    currentProxyInfo.value = {
      ip: response.ip,
      country: response.country,
      region: response.region,
      city: response.city,
      location: response.location,
    };
  } catch (error: any) {
    if (requestId !== currentProxyInfoRequestId) return;
    currentProxyInfo.value = null;
    currentProxyInfoError.value = error?.message || String(error);
  } finally {
    if (requestId === currentProxyInfoRequestId) currentProxyInfoLoading.value = false;
  }
}

async function toggleProxy(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked;
  const previous = proxy.enabled;
  proxySaving.value = true;
  proxyQuickResult.value = '';
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'proxy_configure',
      config: {
        ...proxy,
        enabled,
        domains: proxyDomains.value
          .split(/[\n,]/)
          .map((domain) => domain.trim())
          .filter(Boolean),
      },
    });
    if (!response?.success) throw new Error(response?.error || 'Toggle failed');
    Object.assign(proxy, response.config);
    proxyQuickResult.value = enabled ? 'Proxy turned on' : 'Proxy turned off';
  } catch (error: any) {
    proxy.enabled = previous;
    proxyQuickResult.value = `Error: ${error?.message || String(error)}`;
  } finally {
    proxySaving.value = false;
    if (proxy.enabled) void refreshCurrentProxyInfo();
    else {
      currentProxyInfoRequestId++;
      currentProxyInfo.value = null;
      currentProxyInfoLoading.value = false;
    }
  }
}

async function openProxySettings() {
  await loadProxySettings();
  showProxyModal.value = true;
}

async function rotateCurrentProxy() {
  if (proxySaving.value) return;
  proxySaving.value = true;
  proxyRotationPending.value = true;
  showProxyRotationResult.value = false;
  proxyRotationResult.value = null;
  proxyQuickResult.value = 'Switching, please wait...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) throw new Error('No web tab available to rotate the proxy for');
    const response = await chrome.runtime.sendMessage({
      type: 'proxy_rotate_current',
      tabId: tab.id,
      reason: 'User manually rotated the IP from the extension',
    });
    if (!response?.success) throw new Error(response?.error || 'Failed to rotate the IP');
    const result = response.result as
      | {
          rotated?: boolean;
          skipped?: string;
          previousIp?: string;
          currentIp?: string;
          previousCountry?: string;
          currentCountry?: string;
          previousRegion?: string;
          currentRegion?: string;
          previousCity?: string;
          currentCity?: string;
          previousLocation?: string;
          currentLocation?: string;
        }
      | undefined;
    if (!result?.rotated) {
      const reasons: Record<string, string> = {
        proxy_disabled: 'Proxy is disabled',
        rotation_in_progress: 'This tab is already rotating',
        rate_limited: 'Rotating too frequently, try again later',
        outside_proxy_scope: 'The current page is outside the proxy scope',
      };
      throw new Error(
        (result?.skipped ? reasons[result.skipped] : undefined) || 'IP was not rotated',
      );
    }
    proxyRotationResult.value = {
      previousIp: result.previousIp,
      currentIp: result.currentIp,
      previousCountry: result.previousCountry,
      currentCountry: result.currentCountry,
      previousRegion: result.previousRegion,
      currentRegion: result.currentRegion,
      previousCity: result.previousCity,
      currentCity: result.currentCity,
      previousLocation: result.previousLocation,
      currentLocation: result.currentLocation,
    };
    currentProxyInfoRequestId++;
    currentProxyInfoLoading.value = false;
    if (result.currentIp) {
      currentProxyInfo.value = {
        ip: result.currentIp,
        country: result.currentCountry,
        region: result.currentRegion,
        city: result.currentCity,
        location: result.currentLocation,
      };
      currentProxyInfoError.value = '';
    } else {
      void refreshCurrentProxyInfo();
    }
    proxyQuickResult.value = 'IP rotated.';
    showProxyRotationResult.value = true;
  } catch (error: any) {
    proxyQuickResult.value = `Error: ${error?.message || String(error)}`;
  } finally {
    proxyRotationPending.value = false;
    proxySaving.value = false;
  }
}

function closeProxyRotationResult() {
  showProxyRotationResult.value = false;
}

function formatProxyLocation(
  result: typeof proxyRotationResult.value,
  side: 'previous' | 'current',
): string {
  if (!result) return '';
  return joinProxyLocation(
    result[`${side}Country`],
    result[`${side}Region`],
    result[`${side}City`],
    result[`${side}Location`],
  );
}

function joinProxyLocation(
  country?: string,
  region?: string,
  city?: string,
  location?: string,
): string {
  if (location) return location;
  return [
    country ? `Country: ${country}` : '',
    region ? `Region/state/province: ${region}` : '',
    city ? `City: ${city}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function isCookiePageUrl(url: unknown): url is string {
  try {
    const protocol = new URL(String(url)).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function cookieKey(cookie: chrome.cookies.Cookie): string {
  return [
    cookie.storeId,
    cookie.domain,
    cookie.path,
    cookie.name,
    cookie.partitionKey?.topLevelSite || '',
    cookie.partitionKey?.hasCrossSiteAncestor ? 'cross-site' : '',
  ].join('|');
}

async function loadCookiesForTab(tab: CookieTabState, stores?: chrome.cookies.CookieStore[]) {
  tab.loading = true;
  tab.error = '';
  try {
    const availableStores = stores || (await chrome.cookies.getAllCookieStores());
    tab.storeId ||= availableStores.find((store) => store.tabIds.includes(tab.id))?.id;
    const details: chrome.cookies.GetAllDetails = { url: tab.url };
    if (tab.storeId) details.storeId = tab.storeId;
    const cookies = await chrome.cookies.getAll(details);
    tab.cookies = cookies
      .sort((a, b) =>
        `${a.domain}${a.path}${a.name}`.localeCompare(`${b.domain}${b.path}${b.name}`),
      )
      .map((cookie) => ({ cookie, key: cookieKey(cookie), selected: false }));
  } catch (error: any) {
    tab.cookies = [];
    tab.error = error?.message || 'Failed to read cookies';
  } finally {
    tab.loading = false;
  }
}

async function loadAllCookieTabs() {
  cookieLoading.value = true;
  cookieResult.value = '';
  try {
    const [tabs, stores] = await Promise.all([
      chrome.tabs.query({}),
      chrome.cookies.getAllCookieStores(),
    ]);
    cookieTabs.value = tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } => {
        return Number.isInteger(tab.id) && isCookiePageUrl(tab.url);
      })
      .sort((a, b) => Number(b.active) - Number(a.active))
      .map((tab) => ({
        id: tab.id,
        title: tab.title || '',
        url: tab.url,
        active: tab.active,
        storeId: stores.find((store) => store.tabIds.includes(tab.id))?.id,
        loading: false,
        error: '',
        cookies: [],
      }));
    await Promise.all(cookieTabs.value.map((tab) => loadCookiesForTab(tab, stores)));
  } catch (error: any) {
    cookieTabs.value = [];
    cookieResult.value = `Error: ${error?.message || String(error)}`;
  } finally {
    cookieLoading.value = false;
  }
}

async function openCookieManager() {
  showCookieModal.value = true;
  await loadAllCookieTabs();
}

function selectAllCookies(selected: boolean) {
  for (const tab of cookieTabs.value) {
    setTabCookiesSelected(tab, selected);
  }
}

function setTabCookiesSelected(tab: CookieTabState, selected: boolean) {
  for (const entry of tab.cookies) entry.selected = selected;
}

function invertTabCookies(tab: CookieTabState) {
  for (const entry of tab.cookies) entry.selected = !entry.selected;
}

function invertAllCookies() {
  for (const tab of cookieTabs.value) invertTabCookies(tab);
}

function cookieRemovalUrl(cookie: chrome.cookies.Cookie, pageUrl: string): string {
  const page = new URL(pageUrl);
  const host =
    (cookie.hostOnly ? cookie.domain : cookie.domain.replace(/^\./, '')) || page.hostname;
  const protocol = cookie.secure ? 'https:' : page.protocol;
  return `${protocol}//${host}${cookie.path || '/'}`;
}

async function clearSelectedCookies() {
  const selected = cookieTabs.value.flatMap((tab) =>
    tab.cookies.filter((entry) => entry.selected).map((entry) => ({ tab, entry })),
  );
  if (!selected.length || cookieSaving.value) return;
  if (!window.confirm(`Clear the ${selected.length} selected cookies? Unselected ones are kept.`))
    return;

  cookieSaving.value = true;
  cookieResult.value = '';
  let removed = 0;
  let failed = 0;
  try {
    for (const { tab, entry } of selected) {
      try {
        const result = await chrome.cookies.remove({
          url: cookieRemovalUrl(entry.cookie, tab.url),
          name: entry.cookie.name,
          storeId: entry.cookie.storeId,
          ...(entry.cookie.partitionKey ? { partitionKey: entry.cookie.partitionKey } : {}),
        });
        if (result) removed += 1;
      } catch {
        failed += 1;
      }
    }
    await loadAllCookieTabs();
    cookieResult.value = failed
      ? `Cleared ${removed}, ${failed} failed to clear.`
      : `Cleared ${removed} cookies; unselected cookies were kept.`;
  } finally {
    cookieSaving.value = false;
  }
}

async function toggleWebEditor() {
  try {
    await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_TOGGLE });
  } catch (error) {
    console.warn('Failed to toggle web editor mode:', error);
  }
}

async function toggleElementMarker() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn('Cannot get the current tab');
      return;
    }

    // Send a message to the background to start element markers
    await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_START,
      tabId: tab.id,
    });
  } catch (error) {
    console.warn('Failed to start element markers:', error);
  }
}

async function openWelcomePage() {
  if (!hiddenInterfaceUnlocked.value) return;

  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  } catch {
    // ignore
  }
}

async function openTroubleshooting() {
  try {
    await chrome.tabs.create({ url: LINKS.TROUBLESHOOTING });
  } catch {
    // ignore
  }
}

function openBuilderWindow(flowId?: string, focusNodeId?: string) {
  const url = new URL(chrome.runtime.getURL('builder.html'));
  if (flowId) url.searchParams.set('flowId', flowId);
  if (focusNodeId) url.searchParams.set('focus', focusNodeId);
  chrome.windows.create({ url: url.toString(), type: 'popup', width: 1280, height: 800 });
}

const getStatusText = () => {
  if (nativeConnectionStatus.value === 'connected') {
    if (serverStatus.value.isRunning) {
      return getMessage('serviceRunningStatus', [
        (serverStatus.value.port || 'Unknown').toString(),
      ]);
    } else {
      return getMessage('connectedServiceNotStartedStatus');
    }
  } else if (nativeConnectionStatus.value === 'disconnected') {
    return getMessage('serviceNotConnectedStatus');
  } else {
    return getMessage('detectingStatus');
  }
};

const formatIndexSize = () => {
  if (!storageStats.value?.indexSize) return '0 MB';
  const sizeInMB = Math.round(storageStats.value.indexSize / (1024 * 1024));
  return `${sizeInMB} MB`;
};

const getModelDescription = (model: any) => {
  switch (model.preset) {
    case 'multilingual-e5-small':
      return getMessage('lightweightModelDescription');
    case 'multilingual-e5-base':
      return getMessage('betterThanSmallDescription');
    default:
      return getMessage('multilingualModelDescription');
  }
};

const getPerformanceText = (performance: string) => {
  switch (performance) {
    case 'fast':
      return getMessage('fastPerformance');
    case 'balanced':
      return getMessage('balancedPerformance');
    case 'accurate':
      return getMessage('accuratePerformance');
    default:
      return performance;
  }
};

const getSemanticEngineStatusText = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return getMessage('semanticEngineReadyStatus');
    case 'initializing':
      return getMessage('semanticEngineInitializingStatus');
    case 'error':
      return getMessage('semanticEngineInitFailedStatus');
    case 'idle':
    default:
      return getMessage('semanticEngineNotInitStatus');
  }
};

const getSemanticEngineStatusClass = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return 'bg-emerald-500';
    case 'initializing':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    case 'idle':
    default:
      return 'bg-gray-500';
  }
};

const getActiveTabsCount = () => {
  return storageStats.value?.totalTabs || 0;
};

const getProgressText = () => {
  if (isModelDownloading.value) {
    return getMessage('downloadingModelStatus', [modelDownloadProgress.value.toString()]);
  } else if (isModelSwitching.value) {
    return modelSwitchProgress.value || getMessage('switchingModelStatus');
  }
  return '';
};

const getErrorTypeText = () => {
  switch (modelErrorType.value) {
    case 'network':
      return getMessage('networkErrorMessage');
    case 'file':
      return getMessage('modelCorruptedErrorMessage');
    case 'unknown':
    default:
      return getMessage('unknownErrorMessage');
  }
};

const getSemanticEngineButtonText = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return getMessage('reinitializeButton');
    case 'initializing':
      return getMessage('initializingStatus');
    case 'error':
      return getMessage('reinitializeButton');
    case 'idle':
    default:
      return getMessage('initSemanticEngineButton');
  }
};

const loadCacheStats = async () => {
  try {
    cacheStats.value = await getCacheStats();
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    cacheStats.value = null;
  }
};

const cleanupCache = async () => {
  if (isManagingCache.value) return;

  isManagingCache.value = true;
  try {
    await cleanupModelCache();
    // Refresh cache stats
    await loadCacheStats();
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
  } finally {
    isManagingCache.value = false;
  }
};

const clearAllCache = async () => {
  if (isManagingCache.value) return;

  isManagingCache.value = true;
  try {
    await clearModelCache();
    // Refresh cache stats
    await loadCacheStats();
  } catch (error) {
    console.error('Failed to clear cache:', error);
  } finally {
    isManagingCache.value = false;
  }
};

const saveSemanticEngineState = async () => {
  try {
    const semanticEngineState = {
      status: semanticEngineStatus.value,
      lastUpdated: semanticEngineLastUpdated.value,
    };

    await chrome.storage.local.set({ semanticEngineState });
  } catch (error) {
    console.error('Failed to save semantic engine state:', error);
  }
};

const initializeSemanticEngine = async () => {
  if (isSemanticEngineInitializing.value) return;

  const isReinitialization = semanticEngineStatus.value === 'ready';
  console.log(
    `🚀 User triggered semantic engine ${isReinitialization ? 'reinitialization' : 'initialization'}`,
  );

  isSemanticEngineInitializing.value = true;
  semanticEngineStatus.value = 'initializing';
  semanticEngineInitProgress.value = isReinitialization
    ? getMessage('semanticEngineInitializingStatus')
    : getMessage('semanticEngineInitializingStatus');
  semanticEngineLastUpdated.value = Date.now();

  await saveSemanticEngineState();

  try {
    chrome.runtime
      .sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.INITIALIZE_SEMANTIC_ENGINE,
      })
      .catch((error) => {
        console.error('❌ Error sending semantic engine initialization request:', error);
      });

    startSemanticEngineStatusPolling();

    semanticEngineInitProgress.value = isReinitialization
      ? getMessage('processingStatus')
      : getMessage('processingStatus');
  } catch (error: any) {
    console.error('❌ Failed to send initialization request:', error);
    semanticEngineStatus.value = 'error';
    semanticEngineInitProgress.value = `Failed to send initialization request: ${error?.message || 'Unknown error'}`;

    await saveSemanticEngineState();

    setTimeout(() => {
      semanticEngineInitProgress.value = '';
    }, 5000);

    isSemanticEngineInitializing.value = false;
    semanticEngineLastUpdated.value = Date.now();
    await saveSemanticEngineState();
  }
};

const checkSemanticEngineStatus = async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.GET_MODEL_STATUS,
    });

    if (response && response.success && response.status) {
      const status = response.status;

      if (status.initializationStatus === 'ready') {
        semanticEngineStatus.value = 'ready';
        semanticEngineLastUpdated.value = Date.now();
        isSemanticEngineInitializing.value = false;
        semanticEngineInitProgress.value = getMessage('semanticEngineReadyStatus');
        await saveSemanticEngineState();
        stopSemanticEngineStatusPolling();
        setTimeout(() => {
          semanticEngineInitProgress.value = '';
        }, 2000);
      } else if (
        status.initializationStatus === 'downloading' ||
        status.initializationStatus === 'initializing'
      ) {
        semanticEngineStatus.value = 'initializing';
        isSemanticEngineInitializing.value = true;
        semanticEngineInitProgress.value = getMessage('semanticEngineInitializingStatus');
        semanticEngineLastUpdated.value = Date.now();
        await saveSemanticEngineState();
      } else if (status.initializationStatus === 'error') {
        semanticEngineStatus.value = 'error';
        semanticEngineLastUpdated.value = Date.now();
        isSemanticEngineInitializing.value = false;
        semanticEngineInitProgress.value = getMessage('semanticEngineInitFailedStatus');
        await saveSemanticEngineState();
        stopSemanticEngineStatusPolling();
        setTimeout(() => {
          semanticEngineInitProgress.value = '';
        }, 5000);
      } else {
        semanticEngineStatus.value = 'idle';
        isSemanticEngineInitializing.value = false;
        await saveSemanticEngineState();
      }
    } else {
      semanticEngineStatus.value = 'idle';
      isSemanticEngineInitializing.value = false;
      await saveSemanticEngineState();
    }
  } catch (error) {
    console.error('Popup: Failed to check semantic engine status:', error);
    semanticEngineStatus.value = 'idle';
    isSemanticEngineInitializing.value = false;
    await saveSemanticEngineState();
  }
};

const retryModelInitialization = async () => {
  if (!currentModel.value) return;

  console.log('🔄 Retrying model initialization...');

  modelErrorMessage.value = '';
  modelErrorType.value = '';
  modelInitializationStatus.value = 'downloading';
  modelDownloadProgress.value = 0;
  isModelDownloading.value = true;
  await switchModel(currentModel.value);
};

const updatePort = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const newPort = Number(target.value);
  nativeServerPort.value = newPort;

  await savePortPreference(newPort);
};

const checkNativeConnection = async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'ping_native' });
    nativeConnectionStatus.value = response?.connected ? 'connected' : 'disconnected';
  } catch (error) {
    console.error('Failed to check native connection status:', error);
    nativeConnectionStatus.value = 'disconnected';
  }
};

const checkServerStatus = async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS,
    });
    if (response?.success && response.serverStatus) {
      serverStatus.value = response.serverStatus;
      await loadPackageVersions();
    }

    if (response?.connected !== undefined) {
      nativeConnectionStatus.value = response.connected ? 'connected' : 'disconnected';
    }
  } catch (error) {
    console.error('Failed to check server status:', error);
  }
};

const refreshServerStatus = async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS,
    });
    if (response?.success && response.serverStatus) {
      serverStatus.value = response.serverStatus;
      await loadPackageVersions();
    }

    if (response?.connected !== undefined) {
      nativeConnectionStatus.value = response.connected ? 'connected' : 'disconnected';
    }
  } catch (error) {
    console.error('Failed to refresh server status:', error);
  }
};

const loadPackageVersions = async () => {
  if (!serverStatus.value.isRunning) {
    packageVersions.value = null;
    return;
  }
  try {
    const port = serverStatus.value.port || nativeServerPort.value;
    const status = await fetch(`http://127.0.0.1:${port}/status`).then((response) =>
      response.json(),
    );
    const packages = status?.packages;
    packageVersions.value =
      typeof packages?.['mcp-chrome-bridge-2026'] === 'string'
        ? packages['mcp-chrome-bridge-2026']
        : null;
  } catch {
    packageVersions.value = null;
  }
};

const copyMcpConfig = async () => {
  try {
    await navigator.clipboard.writeText(mcpConfigJson.value);
    copyButtonText.value = '✅' + getMessage('configCopiedNotification');

    setTimeout(() => {
      copyButtonText.value = getMessage('copyConfigButton');
    }, 2000);
  } catch (error) {
    console.error('Failed to copy config:', error);
    copyButtonText.value = '❌' + getMessage('networkErrorMessage');

    setTimeout(() => {
      copyButtonText.value = getMessage('copyConfigButton');
    }, 2000);
  }
};

const startService = async () => {
  try {
    await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.START_NATIVE_SERVER,
      port: nativeServerPort.value,
    });
    setTimeout(refreshServerStatus, 1500);
  } catch (e) {
    console.error('Start service failed:', e);
  }
};

const testNativeConnection = async () => {
  if (isConnecting.value) return;
  isConnecting.value = true;
  try {
    if (nativeConnectionStatus.value === 'connected') {
      await chrome.runtime.sendMessage({ type: 'disconnect_native' });
      nativeConnectionStatus.value = 'disconnected';
    } else {
      console.log(`Trying to connect to port: ${nativeServerPort.value}`);

      const response = await chrome.runtime.sendMessage({
        type: 'connectNative',
        port: nativeServerPort.value,
      });
      if (response && response.success) {
        nativeConnectionStatus.value = 'connected';
        console.log('Connected:', response);
        await savePortPreference(nativeServerPort.value);
      } else {
        nativeConnectionStatus.value = 'disconnected';
        console.error('Connection failed:', response);
      }
    }
  } catch (error) {
    console.error('Connection test failed:', error);
    nativeConnectionStatus.value = 'disconnected';
  } finally {
    isConnecting.value = false;
  }
};

const loadModelPreference = async () => {
  try {
    const result = await chrome.storage.local.get([
      'selectedModel',
      'selectedVersion',
      'modelState',
      'semanticEngineState',
    ]);

    if (result.selectedModel) {
      const storedModel = result.selectedModel as string;
      console.log('📋 Stored model from storage:', storedModel);

      if (PREDEFINED_MODELS[storedModel as ModelPreset]) {
        currentModel.value = storedModel as ModelPreset;
        console.log(`✅ Loaded valid model: ${currentModel.value}`);
      } else {
        console.warn(
          `⚠️ Stored model "${storedModel}" not found in PREDEFINED_MODELS, using default`,
        );
        currentModel.value = 'multilingual-e5-small';
        await saveModelPreference(currentModel.value);
      }
    } else {
      console.log('⚠️ No model found in storage, using default');
      currentModel.value = 'multilingual-e5-small';
      await saveModelPreference(currentModel.value);
    }

    selectedVersion.value = 'quantized';
    console.log('✅ Using quantized version (fixed)');

    await saveVersionPreference('quantized');

    if (result.modelState) {
      const modelState = result.modelState;

      if (modelState.status === 'ready') {
        modelInitializationStatus.value = 'ready';
        modelDownloadProgress.value = modelState.downloadProgress || 100;
        isModelDownloading.value = false;
      } else {
        modelInitializationStatus.value = 'idle';
        modelDownloadProgress.value = 0;
        isModelDownloading.value = false;

        await saveModelState();
      }
    } else {
      modelInitializationStatus.value = 'idle';
      modelDownloadProgress.value = 0;
      isModelDownloading.value = false;
    }

    if (result.semanticEngineState) {
      const semanticState = result.semanticEngineState;
      if (semanticState.status === 'ready') {
        semanticEngineStatus.value = 'ready';
        semanticEngineLastUpdated.value = semanticState.lastUpdated || Date.now();
      } else if (semanticState.status === 'error') {
        semanticEngineStatus.value = 'error';
        semanticEngineLastUpdated.value = semanticState.lastUpdated || Date.now();
      } else {
        semanticEngineStatus.value = 'idle';
      }
    } else {
      semanticEngineStatus.value = 'idle';
    }
  } catch (error) {
    console.error('❌ Failed to load model preference:', error);
  }
};

const saveModelPreference = async (model: ModelPreset) => {
  try {
    await chrome.storage.local.set({ selectedModel: model });
  } catch (error) {
    console.error('Failed to save model preference:', error);
  }
};

const saveVersionPreference = async (version: 'full' | 'quantized' | 'compressed') => {
  try {
    await chrome.storage.local.set({ selectedVersion: version });
  } catch (error) {
    console.error('Failed to save version preference:', error);
  }
};

const savePortPreference = async (port: number) => {
  try {
    await chrome.storage.local.set({ nativeServerPort: port });
    console.log(`Port preference saved: ${port}`);
  } catch (error) {
    console.error('Failed to save port preference:', error);
  }
};

const loadPortPreference = async () => {
  try {
    const result = await chrome.storage.local.get(['nativeServerPort']);
    if (result.nativeServerPort) {
      nativeServerPort.value = result.nativeServerPort;
      console.log(`Port preference loaded: ${result.nativeServerPort}`);
    }
  } catch (error) {
    console.error('Failed to load port preference:', error);
  }
};

const loadBackgroundOperations = async () => {
  const { backgroundOperations: stored = true } =
    await chrome.storage.local.get('backgroundOperations');
  backgroundOperations.value = stored !== false;
};

const saveBackgroundOperations = async () => {
  await chrome.storage.local.set({ backgroundOperations: backgroundOperations.value });
};

const normalizeContentMessageTimeoutSeconds = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(300, Math.max(5, Math.round(parsed)));
};

const loadContentMessageTimeout = async () => {
  const settings = await chrome.storage.local.get(STORAGE_KEYS.CONTENT_MESSAGE_TIMEOUT);
  const timeoutMs = settings[STORAGE_KEYS.CONTENT_MESSAGE_TIMEOUT];
  contentMessageTimeoutSeconds.value = normalizeContentMessageTimeoutSeconds(
    Number(timeoutMs) / 1000,
  );
};

const saveContentMessageTimeout = async () => {
  contentMessageTimeoutSeconds.value = normalizeContentMessageTimeoutSeconds(
    contentMessageTimeoutSeconds.value,
  );
  await chrome.storage.local.set({
    [STORAGE_KEYS.CONTENT_MESSAGE_TIMEOUT]: contentMessageTimeoutSeconds.value * 1000,
  });
};

const loadScrollCoordinatesSetting = async () => {
  const settings = await chrome.storage.local.get(STORAGE_KEYS.WEB_EDITOR_SEND_SCROLL_COORDINATES);
  sendScrollCoordinates.value = settings[STORAGE_KEYS.WEB_EDITOR_SEND_SCROLL_COORDINATES] === true;
};

const saveScrollCoordinatesSetting = async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.WEB_EDITOR_SEND_SCROLL_COORDINATES]: sendScrollCoordinates.value,
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: WEB_EDITOR_V3_ACTIONS.SET_SCROLL_COORDINATES,
      enabled: sendScrollCoordinates.value,
    });
  } catch {
    // The page editor is not active in this tab; its saved setting is applied on next start.
  }
};

const saveModelState = async () => {
  try {
    const modelState = {
      status: modelInitializationStatus.value,
      downloadProgress: modelDownloadProgress.value,
      isDownloading: isModelDownloading.value,
      lastUpdated: Date.now(),
    };

    await chrome.storage.local.set({ modelState });
  } catch (error) {
    console.error('Failed to save model state:', error);
  }
};

let statusMonitoringInterval: ReturnType<typeof setInterval> | null = null;
let semanticEngineStatusPollingInterval: ReturnType<typeof setInterval> | null = null;

const startModelStatusMonitoring = () => {
  if (statusMonitoringInterval) {
    clearInterval(statusMonitoringInterval);
  }

  statusMonitoringInterval = setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'get_model_status',
      });

      if (response && response.success) {
        const status = response.status;
        modelInitializationStatus.value = status.initializationStatus || 'idle';
        modelDownloadProgress.value = status.downloadProgress || 0;
        isModelDownloading.value = status.isDownloading || false;

        if (status.initializationStatus === 'error') {
          modelErrorMessage.value = status.errorMessage || getMessage('modelFailedStatus');
          modelErrorType.value = status.errorType || 'unknown';
        } else {
          modelErrorMessage.value = '';
          modelErrorType.value = '';
        }

        await saveModelState();

        if (status.initializationStatus === 'ready' || status.initializationStatus === 'error') {
          stopModelStatusMonitoring();
        }
      }
    } catch (error) {
      console.error('Failed to get model status:', error);
    }
  }, 1000);
};

const stopModelStatusMonitoring = () => {
  if (statusMonitoringInterval) {
    clearInterval(statusMonitoringInterval);
    statusMonitoringInterval = null;
  }
};

const startSemanticEngineStatusPolling = () => {
  if (semanticEngineStatusPollingInterval) {
    clearInterval(semanticEngineStatusPollingInterval);
  }

  semanticEngineStatusPollingInterval = setInterval(async () => {
    try {
      await checkSemanticEngineStatus();
    } catch (error) {
      console.error('Semantic engine status polling failed:', error);
    }
  }, 2000);
};

const stopSemanticEngineStatusPolling = () => {
  if (semanticEngineStatusPollingInterval) {
    clearInterval(semanticEngineStatusPollingInterval);
    semanticEngineStatusPollingInterval = null;
  }
};

const refreshStorageStats = async () => {
  if (isRefreshingStats.value) return;

  isRefreshingStats.value = true;
  try {
    console.log('🔄 Refreshing storage statistics...');

    const response = await chrome.runtime.sendMessage({
      type: 'get_storage_stats',
    });

    if (response && response.success) {
      storageStats.value = {
        indexedPages: response.stats.indexedPages || 0,
        totalDocuments: response.stats.totalDocuments || 0,
        totalTabs: response.stats.totalTabs || 0,
        indexSize: response.stats.indexSize || 0,
        isInitialized: response.stats.isInitialized || false,
      };
      console.log('✅ Storage stats refreshed:', storageStats.value);
    } else {
      console.error('❌ Failed to get storage stats:', response?.error);
      storageStats.value = {
        indexedPages: 0,
        totalDocuments: 0,
        totalTabs: 0,
        indexSize: 0,
        isInitialized: false,
      };
    }
  } catch (error) {
    console.error('❌ Error refreshing storage stats:', error);
    storageStats.value = {
      indexedPages: 0,
      totalDocuments: 0,
      totalTabs: 0,
      indexSize: 0,
      isInitialized: false,
    };
  } finally {
    isRefreshingStats.value = false;
  }
};

const hideClearDataConfirmation = () => {
  showClearConfirmation.value = false;
};

const confirmClearAllData = async () => {
  if (isClearingData.value) return;

  isClearingData.value = true;
  clearDataProgress.value = getMessage('clearingStatus');

  try {
    console.log('🗑️ Starting to clear all data...');

    const response = await chrome.runtime.sendMessage({
      type: 'clear_all_data',
    });

    if (response && response.success) {
      clearDataProgress.value = getMessage('dataClearedNotification');
      console.log('✅ All data cleared successfully');

      await refreshStorageStats();

      setTimeout(() => {
        clearDataProgress.value = '';
        hideClearDataConfirmation();
      }, 2000);
    } else {
      throw new Error(response?.error || 'Failed to clear data');
    }
  } catch (error: any) {
    console.error('❌ Failed to clear all data:', error);
    clearDataProgress.value = `Failed to clear data: ${error?.message || 'Unknown error'}`;

    setTimeout(() => {
      clearDataProgress.value = '';
    }, 5000);
  } finally {
    isClearingData.value = false;
  }
};

const switchModel = async (newModel: ModelPreset) => {
  console.log(`🔄 switchModel called with newModel: ${newModel}`);

  if (isModelSwitching.value) {
    console.log('⏸️ Model switch already in progress, skipping');
    return;
  }

  const isSameModel = newModel === currentModel.value;
  const currentModelInfo = currentModel.value
    ? getModelInfo(currentModel.value)
    : getModelInfo('multilingual-e5-small');
  const newModelInfo = getModelInfo(newModel);
  const isDifferentDimension = currentModelInfo.dimension !== newModelInfo.dimension;

  console.log(`📊 Switch analysis:`);
  console.log(`   - Same model: ${isSameModel} (${currentModel.value} -> ${newModel})`);
  console.log(
    `   - Current dimension: ${currentModelInfo.dimension}, New dimension: ${newModelInfo.dimension}`,
  );
  console.log(`   - Different dimension: ${isDifferentDimension}`);

  if (isSameModel && !isDifferentDimension) {
    console.log('✅ Same model and dimension - no need to switch');
    return;
  }

  const switchReasons = [];
  if (!isSameModel) switchReasons.push('different model');
  if (isDifferentDimension) switchReasons.push('different dimension');

  console.log(`🚀 Switching model due to: ${switchReasons.join(', ')}`);
  console.log(
    `📋 Model: ${currentModel.value} (${currentModelInfo.dimension}D) -> ${newModel} (${newModelInfo.dimension}D)`,
  );

  isModelSwitching.value = true;
  modelSwitchProgress.value = getMessage('switchingModelStatus');

  modelInitializationStatus.value = 'downloading';
  modelDownloadProgress.value = 0;
  isModelDownloading.value = true;

  try {
    await saveModelPreference(newModel);
    await saveVersionPreference('quantized');
    await saveModelState();

    modelSwitchProgress.value = getMessage('semanticEngineInitializingStatus');

    startModelStatusMonitoring();

    const response = await chrome.runtime.sendMessage({
      type: 'switch_semantic_model',
      modelPreset: newModel,
      modelVersion: 'quantized',
      modelDimension: newModelInfo.dimension,
      previousDimension: currentModelInfo.dimension,
    });

    if (response && response.success) {
      currentModel.value = newModel;
      modelSwitchProgress.value = getMessage('successNotification');
      console.log(
        'Model switched:',
        newModel,
        'version: quantized',
        'dimension:',
        newModelInfo.dimension,
      );

      modelInitializationStatus.value = 'ready';
      isModelDownloading.value = false;
      await saveModelState();

      setTimeout(() => {
        modelSwitchProgress.value = '';
      }, 2000);
    } else {
      throw new Error(response?.error || 'Model switch failed');
    }
  } catch (error: any) {
    console.error('Model switch failed:', error);
    modelSwitchProgress.value = `Model switch failed: ${error?.message || 'Unknown error'}`;

    modelInitializationStatus.value = 'error';
    isModelDownloading.value = false;

    const errorMessage = error?.message || 'Unknown error';
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout')
    ) {
      modelErrorType.value = 'network';
      modelErrorMessage.value = getMessage('networkErrorMessage');
    } else if (
      errorMessage.includes('corrupt') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('format')
    ) {
      modelErrorType.value = 'file';
      modelErrorMessage.value = getMessage('modelCorruptedErrorMessage');
    } else {
      modelErrorType.value = 'unknown';
      modelErrorMessage.value = errorMessage;
    }

    await saveModelState();

    setTimeout(() => {
      modelSwitchProgress.value = '';
    }, 8000);
  } finally {
    isModelSwitching.value = false;
  }
};

const setupServerStatusListener = () => {
  const onMessage = (message: { type?: string; payload?: unknown }) => {
    // Server status changes
    if (message.type === BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED && message.payload) {
      serverStatus.value = message.payload as any;
      void loadPackageVersions();
      console.log('Server status updated:', message.payload);
    }
    // Flows changed - refresh list (IndexedDB-based notification)
    if (message.type === BACKGROUND_MESSAGE_TYPES.RR_FLOWS_CHANGED) {
      loadFlows();
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  // Store reference for cleanup
  (window as any).__rr_popup_onMessage = onMessage;
};

onMounted(async () => {
  await loadHiddenInterfaceState();
  // Initialize theme
  await initTheme();
  await loadPortPreference();
  await loadProxySettings();
  void refreshCurrentProxyInfo();
  await loadBackgroundOperations();
  await loadContentMessageTimeout();
  await loadScrollCoordinatesSetting();
  await loadModelPreference();
  await checkNativeConnection();
  await checkServerStatus();
  await refreshStorageStats();
  await loadCacheStats();
  await loadFlows();
  try {
    const result = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.RR_GET_RECORDING_STATUS,
    });
    rrRecording.value = result?.status === 'recording' || result?.status === 'paused';
    rrPaused.value = result?.status === 'paused';
  } catch {}
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl.value = tab?.url || '';
  } catch {}

  await checkSemanticEngineStatus();
  setupServerStatusListener();
  // Auto-refresh workflows list when storage rr_flows changes
  try {
    const onChanged = (changes: any, area: string) => {
      try {
        if (area !== 'local') return;
        if (Object.prototype.hasOwnProperty.call(changes || {}, 'rr_flows')) loadFlows();
      } catch {}
    };
    chrome.storage.onChanged.addListener(onChanged);
    (window as any).__rr_popup_onChanged = onChanged;
  } catch {}
});

onUnmounted(() => {
  stopModelStatusMonitoring();
  stopSemanticEngineStatusPolling();
  // Clean up runtime message listener
  try {
    const msgFn = (window as any).__rr_popup_onMessage;
    if (msgFn && chrome?.runtime?.onMessage?.removeListener) {
      chrome.runtime.onMessage.removeListener(msgFn);
    }
  } catch {}
  // Clean up storage change listener (legacy fallback)
  try {
    const fn = (window as any).__rr_popup_onChanged;
    if (fn && chrome?.storage?.onChanged?.removeListener) {
      chrome.storage.onChanged.removeListener(fn);
    }
  } catch {}
});
</script>

<style scoped>
.popup-container {
  position: relative;
  height: 100%;
  min-height: 0;
  background: var(--ac-bg, #f8fafc);
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.popup-container--premium {
  background: var(--ac-bg, #f8fafc);
}

.popup-container--unlocked {
  background:
    linear-gradient(rgba(255, 255, 255, 0.43), rgba(255, 255, 255, 0.43)),
    linear-gradient(120deg, rgba(255, 255, 255, 0.34), rgba(248, 246, 251, 0.14)),
    url('../../assets/catgirl-chat-background.webp') center / cover;
}

.popup-container--unlocked.popup-container--premium {
  background:
    linear-gradient(rgba(255, 255, 255, 0.43), rgba(255, 255, 255, 0.43)),
    linear-gradient(120deg, rgba(255, 255, 255, 0.28), rgba(248, 246, 251, 0.12)),
    url('/backgrounds/catgirl-premium-portrait.webp') center top / cover;
}

.popup-container:not(.popup-container--unlocked) {
  background-image: none !important;
  --ac-bg-pattern: none !important;
}

.popup-container--premium :deep(.mcp-tools-page) {
  background: rgba(253, 252, 248, 0.62) !important;
}

.popup-container--premium :deep(.local-model-page .page-header),
.popup-container--premium :deep(.mcp-tools-page .page-header) {
  background: rgba(255, 255, 255, 0.76) !important;
  backdrop-filter: blur(10px);
}

.header {
  flex-shrink: 0;
  padding-left: 20px;
  background: rgba(255, 255, 255, 0.28);
  border-bottom: 1px solid rgba(255, 255, 255, 0.44);
  backdrop-filter: blur(14px);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.header-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  box-shadow: 0 4px 14px rgba(72, 57, 78, 0.16);
}

.header-logo-button {
  margin-right: 16px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  line-height: 0;
}

.header-logo-button--hidden {
  cursor: default;
}

.header-logo-button:focus-visible {
  outline: 2px solid #7c3aed;
  outline-offset: 3px;
}

.settings-button {
  padding: 8px;
  border-radius: 50%;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-button:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.content {
  flex: 1 1 auto;
  min-height: 0;
  padding: 8px 24px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.content::-webkit-scrollbar {
  display: none;
}
.status-card {
  background: rgba(255, 255, 255, 0.43);
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.status-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 8px;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  transition: background 0.2s ease;
}

.status-banner.bg-green-subtle {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.status-banner.bg-yellow-subtle {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.status-banner.bg-red-subtle {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.status-banner.bg-gray-subtle {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.status-dot {
  flex-shrink: 0;
  height: 12px;
  width: 12px;
  border-radius: 50%;
  transition: box-shadow 0.2s ease;
}

.status-dot.dot-green {
  background-color: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

.status-dot.dot-red {
  background-color: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
}

.status-dot.dot-yellow {
  background-color: #eab308;
  box-shadow: 0 0 6px rgba(234, 179, 8, 0.4);
}

.status-dot.dot-gray {
  background-color: #9ca3af;
  box-shadow: 0 0 6px rgba(156, 163, 175, 0.3);
}

.status-text {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.model-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 4px;
}

.model-name {
  font-weight: 600;
  color: #7c3aed;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.stats-card {
  background: rgba(255, 255, 255, 0.43);
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 16px;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.stats-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
}

.stats-icon {
  padding: 8px;
  border-radius: 8px;
}

.stats-icon.violet {
  background: #ede9fe;
  color: #7c3aed;
}

.stats-icon.teal {
  background: #ccfbf1;
  color: #0d9488;
}

.stats-icon.blue {
  background: #dbeafe;
  color: #2563eb;
}

.stats-icon.green {
  background: #dcfce7;
  color: #16a34a;
}

.stats-value {
  font-size: 30px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.section {
  margin-bottom: 24px;
}

.secondary-button {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.secondary-button:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.secondary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-button:hover {
  background: #2563eb;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}
.current-model-card {
  background: linear-gradient(135deg, #faf5ff, #f3e8ff);
  border: 1px solid #e9d5ff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.current-model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.current-model-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin: 0;
}

.current-model-badge {
  background: #8b5cf6;
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
}

.current-model-name {
  font-size: 16px;
  font-weight: 700;
  color: #7c3aed;
  margin: 0;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-card {
  background: rgba(255, 255, 255, 0.43);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.model-card:hover {
  border-color: #8b5cf6;
}

.model-card.selected {
  border: 2px solid #8b5cf6;
  background: #faf5ff;
}

.model-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.model-info {
  flex: 1;
}

.model-name {
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.model-name.selected-text {
  color: #7c3aed;
}

.model-description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.check-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  background: #8b5cf6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}
.model-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
}

.model-tag.performance {
  background: #d1fae5;
  color: #065f46;
}

.model-tag.size {
  background: #ddd6fe;
  color: #5b21b6;
}

.model-tag.dimension {
  background: #e5e7eb;
  color: #4b5563;
}

.config-card {
  background: rgba(255, 255, 255, 0.43);
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
  backdrop-filter: blur(12px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.semantic-engine-card {
  background: rgba(255, 255, 255, 0.43);
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.semantic-engine-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.semantic-engine-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #8b5cf6;
  color: white;
  font-weight: 600;
  padding: 12px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.semantic-engine-button:hover:not(:disabled) {
  background: #7c3aed;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.semantic-engine-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.refresh-status-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
  color: #64748b;
  transition: all 0.2s ease;
}

.refresh-status-button:hover {
  background: #f1f5f9;
  color: #374151;
}

.status-timestamp {
  flex-shrink: 0;
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}

.package-versions {
  display: grid;
  gap: 2px;
  padding: 8px 2px 0;
  font-size: 11px;
  color: #64748b;
}

.mcp-config-section {
  border-top: 1px solid #f1f5f9;
}

.mcp-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.mcp-config-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin: 0;
}

.mcp-transport-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.mcp-transport-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  padding: 9px 11px;
  text-align: left;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mcp-transport-option:hover {
  background: #faf5ff;
  border-color: #c4b5fd;
}

.mcp-transport-option--selected {
  background: #faf5ff;
  border-color: #8b5cf6;
  box-shadow: inset 3px 0 0 #8b5cf6;
}

.mcp-transport-option:focus-visible {
  outline: 2px solid #8b5cf6;
  outline-offset: 1px;
}

.mcp-transport-option-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mcp-transport-option-title {
  min-width: 0;
  color: #334155;
  font-size: 12px;
  line-height: 1.3;
}

.mcp-transport-option-selected {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 999px;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 10px;
  font-weight: 600;
}

.mcp-transport-option-endpoint {
  color: #475569;
  font-size: 11px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.mcp-transport-option-description {
  color: #64748b;
  font-size: 11px;
  line-height: 1.35;
}

.copy-config-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
  color: #64748b;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.copy-config-button:hover {
  background: #f1f5f9;
  color: #374151;
}

.mcp-config-content {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
}

.mcp-config-json {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #374151;
  margin: 0;
  white-space: pre;
  overflow-x: auto;
}

.connection-group {
  border-top: 1px solid #f1f5f9;
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.extension-id {
  color: #64748b;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.error-log-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.error-log-modal {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.28);
}

.error-log-dialog {
  width: 100%;
  height: calc(100% - 32px);
  box-sizing: border-box;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  background: var(--ac-surface, #ffffff);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(16px);
}

.error-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-log-content {
  min-height: 0;
  max-height: none;
  flex: 1;
  overflow: auto;
  resize: none;
  overscroll-behavior: contain;
  margin: 0;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
  color: #374151;
  font:
    11px/1.4 'Monaco',
    'Menlo',
    monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.recent-scripts-dialog {
  min-height: 240px;
}

.proxy-dialog {
  width: min(100%, 420px);
  height: auto;
  max-height: calc(100% - 32px);
  overflow: auto;
  background: var(--ac-surface, #ffffff);
}

.proxy-description,
.proxy-result {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
}

.proxy-quick-result {
  margin: 0 0 8px;
  color: #475569;
  font-size: 12px;
}

.proxy-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.proxy-live-status {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
}

.proxy-live-status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #334155;
  font-size: 12px;
}

.proxy-live-refresh {
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ac-accent, #d97757);
  font-size: 12px;
  cursor: pointer;
}

.proxy-live-refresh:disabled {
  cursor: default;
  opacity: 0.55;
}

.proxy-live-location,
.proxy-live-placeholder {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.proxy-live-ip {
  color: #166534;
  font:
    12px/1.4 'Monaco',
    'Menlo',
    monospace;
  overflow-wrap: anywhere;
}

.proxy-rotation-dialog {
  width: min(100%, 360px);
  height: auto;
  max-height: calc(100% - 32px);
  background: var(--ac-surface, #ffffff);
}

.proxy-rotation-success {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(22, 163, 74, 0.2);
  border-radius: 10px;
  background: rgba(240, 253, 244, 0.76);
}

.proxy-rotation-icon {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  place-items: center;
  border-radius: 50%;
  background: #16a34a;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
}

.proxy-rotation-copy {
  min-width: 0;
}

.proxy-rotation-copy strong {
  display: block;
  color: #166534;
  font-size: 13px;
}

.proxy-rotation-copy p,
.proxy-rotation-note {
  margin: 4px 0 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
}

.proxy-ip-change {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.72);
}

.proxy-ip-item {
  display: grid;
  min-width: 0;
  gap: 5px;
  text-align: center;
}

.proxy-ip-period {
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.proxy-ip-location {
  min-width: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.proxy-ip-value {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  color: #334155;
  font:
    11px/1.35 'Monaco',
    'Menlo',
    monospace;
  overflow-wrap: anywhere;
  text-align: center;
}

.proxy-ip-value--current {
  border-color: rgba(22, 163, 74, 0.35);
  color: #166534;
}

.proxy-ip-arrow {
  color: var(--ac-accent, #d97757);
  font-size: 17px;
  font-weight: 700;
}

.proxy-rotation-note {
  margin-top: 0;
}

.cookie-dialog {
  width: min(100%, 520px);
  height: auto;
  max-height: calc(100% - 32px);
  overflow: hidden;
  background: var(--ac-surface, #ffffff);
}

.popup-container--unlocked .error-log-dialog,
.popup-container--unlocked .proxy-dialog,
.popup-container--unlocked .cookie-dialog {
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.42), rgba(246, 243, 250, 0.2)),
    url('/backgrounds/catgirl-premium-portrait.webp') center top / cover;
}

.quick-tools-unlock-trigger {
  display: block;
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: default;
}

.quick-tools-unlock-trigger:focus-visible {
  outline: 2px solid var(--ac-accent, #d97757);
  outline-offset: 3px;
  border-radius: 4px;
}

.unlock-dialog {
  height: auto;
  max-width: 360px;
}

.unlock-description {
  margin: 0;
  color: var(--ac-text-muted, #6e6e6e);
  font-size: 13px;
  line-height: 1.5;
}

.unlock-form {
  display: flex;
  gap: 8px;
}

.unlock-form input {
  min-width: 0;
  flex: 1;
}

.unlock-submit {
  flex-shrink: 0;
}

.unlock-error {
  margin: 0;
  color: #dc2626;
  font-size: 12px;
}

.cookie-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.cookie-selected-count {
  margin-left: auto;
  color: #475569;
  font-size: 12px;
}

.cookie-tabs-list {
  flex: 1;
  min-height: 0;
  max-height: 45vh;
  overflow: auto;
  display: grid;
  gap: 8px;
  padding-right: 2px;
}

.cookie-tab-card {
  display: grid;
  gap: 7px;
  padding: 9px;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
}

.cookie-tab-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.cookie-tab-actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.cookie-tab-title {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.cookie-tab-title strong,
.cookie-tab-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cookie-tab-title strong {
  color: #374151;
  font-size: 12px;
}

.cookie-tab-title span,
.cookie-empty,
.cookie-error {
  margin: 0;
  color: #64748b;
  font-size: 11px;
}

.cookie-error {
  color: #b91c1c;
}

.cookie-list {
  display: grid;
  gap: 4px;
  max-height: 180px;
  overflow: auto;
}

.cookie-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 5px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.84);
  cursor: pointer;
}

.cookie-row:hover {
  background: rgba(255, 255, 255, 0.92);
}

.cookie-row input {
  flex-shrink: 0;
  margin-top: 2px;
  accent-color: var(--ac-accent, #d97757);
}

.cookie-info {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.cookie-info strong,
.cookie-info small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cookie-info strong {
  color: #374151;
  font-size: 11px;
}

.cookie-info small {
  color: #64748b;
  font-size: 10px;
}

.proxy-form {
  display: grid;
  gap: 8px;
}

.proxy-form label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 12px;
}

.proxy-form input:not([type='checkbox']),
.proxy-form textarea,
.proxy-form select {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.82);
}

.proxy-form textarea {
  resize: vertical;
}

.proxy-form .proxy-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recent-scripts-list {
  display: grid;
  gap: 8px;
  overflow: auto;
}

.recent-script-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
}

.recent-script-info {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.recent-script-info strong {
  overflow: hidden;
  color: #374151;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-script-info span,
.recent-scripts-empty,
.recent-scripts-message {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.recent-script-actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.danger-action {
  color: #dc2626;
}

.background-operations-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
  color: #374151;
  cursor: pointer;
}

.background-operations-switch span {
  display: grid;
  gap: 2px;
}

.background-operations-switch small {
  color: #64748b;
  font-size: 12px;
}

.background-operations-switch input {
  width: 16px;
  height: 16px;
  accent-color: var(--ac-accent, #d97757);
}

.timeout-input {
  display: flex !important;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.timeout-input input {
  width: 64px !important;
  height: 32px !important;
  box-sizing: border-box;
  padding: 0 7px;
  border: 1px solid #dbe3ed;
  border-radius: 7px;
  color: #374151;
  background: #fff;
  accent-color: auto;
}

.port-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.port-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
}

.port-input-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f8fafc;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.port-input-wrapper:focus-within {
  border-color: var(--ac-accent, #d97757);
  box-shadow: 0 0 0 3px var(--ac-accent-subtle, rgba(217, 119, 87, 0.12));
}

.port-prefix {
  padding: 10px 0 10px 12px;
  font-size: 14px;
  color: #9ca3af;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  user-select: none;
}

.port-input {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  padding: 10px 12px 10px 4px;
  font-size: 14px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  outline: none;
}

.connect-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--ac-accent, #d97757);
  color: var(--ac-accent-contrast, white);
  font-weight: 600;
  padding: 12px 16px;
  border-radius: var(--ac-radius-button, 8px);
  border: none;
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
}

.connect-button:hover:not(:disabled) {
  background: var(--ac-accent-hover, #c4664a);
  box-shadow: var(--ac-shadow-float, 0 4px 20px -2px rgba(0, 0, 0, 0.05));
}

.connect-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.error-card {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.error-content {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.error-details {
  flex: 1;
}

.error-title {
  font-size: 14px;
  font-weight: 600;
  color: #dc2626;
  margin: 0 0 4px 0;
}

.error-message {
  font-size: 14px;
  color: #991b1b;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.error-suggestion {
  font-size: 13px;
  color: #7f1d1d;
  margin: 0;
  line-height: 1.4;
}

.retry-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #dc2626;
  color: white;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  flex-shrink: 0;
}

.retry-button:hover:not(:disabled) {
  background: #b91c1c;
}

.retry-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.danger-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
  font-weight: 600;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 16px;
}

.danger-button:hover:not(:disabled) {
  border-color: #ef4444;
  color: #dc2626;
}

.danger-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Icon sizes - use :deep to apply to child components */
:deep(.icon-small) {
  width: 16px;
  height: 16px;
}

:deep(.icon-default) {
  width: 20px;
  height: 20px;
}

:deep(.icon-medium) {
  width: 24px;
  height: 24px;
}
.footer {
  padding: 16px;
  margin-top: auto;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  margin-bottom: 8px;
}

.footer-link {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.footer-link:hover {
  color: #8b5cf6;
  background: #e2e8f0;
}

.footer-link svg {
  width: 14px;
  height: 14px;
}

.footer-text {
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

@media (max-width: 320px) {
  .popup-container {
    width: 100%;
    height: 100vh;
    border-radius: 0;
  }

  .footer-links {
    gap: 8px;
  }

  .rr-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .rr-controls {
    display: flex;
    gap: 8px;
  }
  .rr-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rr-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    border: 1px solid #eee;
    border-radius: 6px;
  }
  .rr-runoverrides {
    margin-top: 6px;
    border: 1px dashed #e5e7eb;
    border-radius: 8px;
    padding: 8px;
    background: #f9fafb;
  }
  .rr-meta {
    display: flex;
    flex-direction: column;
  }
  .rr-name {
    font-weight: 600;
  }
  .rr-desc {
    font-size: 12px;
    color: #666;
  }
  .empty {
    color: #888;
    font-size: 13px;
  }

  .header {
    padding: 24px 20px 12px;
  }

  .content {
    padding: 8px 20px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .config-card {
    padding: 16px;
    gap: 12px;
  }

  .current-model-card {
    padding: 12px;
    margin-bottom: 12px;
  }

  .stats-card {
    padding: 12px;
  }

  .stats-value {
    font-size: 24px;
  }
}

/* Quick tools icon button styles */
.rr-icon-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-start;
  padding: 16px;
  background: rgba(255, 255, 255, 0.43);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
  backdrop-filter: blur(12px);
}

.quick-tools-help {
  margin: 8px 4px 0;
  color: var(--ac-text-muted, #6e6e6e);
  font-size: 12px;
  line-height: 1.5;
}

.rr-icon-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ac-surface-muted, #f2f0eb);
  border: none;
  border-radius: var(--ac-radius-button, 8px);
  color: var(--ac-text-muted, #6e6e6e);
  cursor: pointer;
  transition:
    background-color var(--ac-motion-fast, 120ms) ease,
    color var(--ac-motion-fast, 120ms) ease,
    box-shadow var(--ac-motion-fast, 120ms) ease;
}

.rr-icon-btn:hover:not(:disabled) {
  box-shadow: var(--ac-shadow-float, 0 4px 20px -2px rgba(0, 0, 0, 0.05));
}

.rr-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.rr-icon-btn svg {
  width: 24px;
  height: 24px;
}

/* Edit button - blue */
.rr-icon-btn-edit {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.rr-icon-btn-edit:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.2);
  color: #1d4ed8;
}

/* Marker button - green */
.rr-icon-btn-marker {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.rr-icon-btn-marker:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.2);
  color: #059669;
}

.rr-icon-btn-logs {
  background: rgba(124, 58, 237, 0.12);
  color: #7c3aed;
}

.quick-tools-error {
  margin: 6px 4px 0;
  color: #dc2626;
  font-size: 12px;
}

.rr-icon-btn-logs:hover:not(:disabled) {
  background: rgba(124, 58, 237, 0.2);
  color: #6d28d9;
}

.rr-icon-btn-record {
  background: rgba(225, 29, 72, 0.12);
  color: #e11d48;
}

.rr-icon-btn-pause {
  background: rgba(217, 119, 6, 0.12);
  color: #d97706;
}

.rr-icon-btn-stop {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
}

.rr-icon-btn-disabled {
  background: #e2e8f0;
  color: #94a3b8;
}

/* CSS Tooltip - instant display */
.has-tooltip {
  position: relative;
}

.has-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--ac-text-inverse, #ffffff);
  background-color: var(--ac-text, #1a1a1a);
  border-radius: var(--ac-radius-button, 8px);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 80ms ease,
    visibility 80ms ease;
  pointer-events: none;
  z-index: 100;
}

.has-tooltip::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--ac-text, #1a1a1a);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 80ms ease,
    visibility 80ms ease;
  pointer-events: none;
  z-index: 100;
}

.has-tooltip:hover::after,
.has-tooltip:hover::before {
  opacity: 1;
  visibility: visible;
}

/* Home view */
.home-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Management entry card styles */
.entry-card {
  background: rgba(255, 255, 255, 0.43);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.entry-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--ac-border, #e7e5e4);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
  text-align: left;
}

.entry-item:last-child {
  border-bottom: none;
}

.entry-item:hover {
  background: var(--ac-hover-bg, #f5f5f4);
}

.entry-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ac-radius-button, 8px);
  flex-shrink: 0;
}

.entry-icon.agent {
  background: rgba(217, 119, 87, 0.12);
  color: var(--ac-accent, #d97757);
}

.entry-icon.workflow {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.entry-icon.marker {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.entry-icon.model {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

.entry-icon.tools {
  background: rgba(14, 116, 144, 0.12);
  color: #0e7490;
}

.entry-icon.recordings {
  background: rgba(236, 72, 153, 0.12);
  color: #db2777;
}

.entry-content {
  flex: 1;
  min-width: 0;
}

.entry-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--ac-text, #1a1a1a);
  line-height: 1.3;
}

.entry-desc {
  display: block;
  font-size: 12px;
  color: var(--ac-text-subtle, #a8a29e);
  line-height: 1.3;
  margin-top: 2px;
}

.entry-arrow {
  color: var(--ac-text-subtle, #a8a29e);
  flex-shrink: 0;
}

/* Coming Soon Badge */
.coming-soon-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ac-accent, #d97757);
  background: rgba(217, 119, 87, 0.12);
  border-radius: 4px;
  vertical-align: middle;
}

.entry-item-coming-soon {
  opacity: 0.7;
}

.entry-item-coming-soon:hover {
  opacity: 0.85;
}

/* Coming Soon Toast */
.coming-soon-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--ac-text, #1a1a1a);
  color: var(--ac-text-inverse, #ffffff);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-float, 0 4px 20px -2px rgba(0, 0, 0, 0.15));
  z-index: 1000;
  white-space: nowrap;
}

.toast-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--ac-accent, #d97757);
}

/* Toast transition */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}

/* Service warning card */
.service-warning {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 10px;
}

.service-warning-icon {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1.4;
  margin-top: 1px;
}

.service-warning-body {
  flex: 1;
  min-width: 0;
}

.service-warning-title {
  font-weight: 600;
  font-size: 14px;
  color: #92400e;
  margin-bottom: 4px;
}

.service-warning-desc {
  font-size: 13px;
  color: #a16207;
  line-height: 1.4;
  margin-bottom: 8px;
}

.service-warning-actions {
  display: flex;
  gap: 8px;
}

.service-warning-btn {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.service-warning-btn:hover {
  background: #fef3c7;
}

.service-warning-btn-primary {
  color: #fff;
  background: #f59e0b;
  border-color: #d97706;
}

.service-warning-btn-primary:hover {
  background: #d97706;
}

/* Catgirl glass theme for the complete, scrollable popup home page. */
.popup-container.popup-container--home {
  color: #182c51;
  background:
    linear-gradient(180deg, rgba(251, 247, 255, 0.04), rgba(255, 248, 242, 0.08)),
    url('/assets/backgrounds/popup-catgirl.webp') center 34% / cover !important;
  --popup-ink: #182c51;
  --popup-muted: #596d91;
  --popup-violet: #7c3aed;
  --popup-glass: rgba(255, 255, 255, 0.2);
  --popup-border: rgba(255, 255, 255, 0.4);
}

.popup-container--home .home-view {
  min-height: 0;
  overflow: hidden;
}

.popup-container--home .header {
  z-index: 1;
  flex-shrink: 0;
  margin: 8px 10px 0;
  padding: 6px 0 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.28);
  box-shadow: 0 8px 26px rgba(64, 47, 94, 0.09);
  backdrop-filter: blur(4px);
}

.popup-container--home .header-content {
  min-height: 34px;
  gap: 8px;
}

.header-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.header-brand-icon {
  width: 27px;
  height: 27px;
  flex: 0 0 27px;
  object-fit: cover;
}

.header-brand-copy {
  min-width: 0;
}

.popup-container--home .header-title {
  overflow: hidden;
  color: var(--popup-ink);
  font-size: 16px;
  font-weight: 750;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-caption {
  margin: 4px 0 0;
  color: #8190ae;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1.8px;
  line-height: 1;
}

.popup-container--home .header-logo-button {
  margin-right: 9px;
}

.popup-container--home .header-logo {
  width: 34px;
  height: 34px;
  border: 2px solid rgba(255, 255, 255, 0.95);
}

.popup-container--home .content {
  margin: 8px 10px 0;
  padding: 12px 10px 20px;
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-bottom: 0;
  border-radius: 24px 24px 0 0;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: none;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.popup-container--home .section {
  margin-bottom: 16px;
}

.popup-container--home .section-title {
  margin: 0 0 9px;
  color: var(--popup-ink);
  font-size: 18px;
  font-weight: 750;
  line-height: 1.3;
}

.popup-container--home .section-description {
  margin: -2px 0 10px;
  color: var(--popup-muted);
  font-size: 13px;
  line-height: 1.4;
}

.popup-container--home .section-title:not(.quick-tools-unlock-trigger)::after {
  display: block;
  width: 44px;
  height: 3px;
  margin-top: 5px;
  border-radius: 999px;
  background: linear-gradient(90deg, #8b5cf6, #ca72ff);
  content: '';
}

.popup-container--home .config-card,
.popup-container--home .entry-card,
.popup-container--home .rr-icon-buttons,
.popup-container--home .proxy-live-status {
  border: 1px solid var(--popup-border);
  border-radius: 19px;
  background: var(--popup-glass);
  box-shadow: 0 10px 30px rgba(50, 41, 78, 0.09);
  backdrop-filter: blur(5px);
}

.popup-container--home .config-card {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.popup-container--home .status-section {
  display: block;
  padding: 11px;
  border: 1px solid rgba(158, 238, 214, 0.72);
  border-radius: 20px;
  background: rgba(249, 250, 255, 0.24);
  box-shadow: 0 9px 25px rgba(43, 157, 127, 0.1);
  backdrop-filter: blur(2px);
}

.popup-container--home .status-section.bg-green-subtle {
  border-color: rgba(158, 238, 214, 0.72);
  background: rgba(230, 255, 246, 0.3);
}

.popup-container--home .status-section.bg-red-subtle {
  border-color: rgba(255, 177, 193, 0.62);
  background: rgba(255, 239, 244, 0.3);
}

.popup-container--home .status-section.bg-yellow-subtle {
  border-color: rgba(255, 215, 152, 0.66);
  background: rgba(255, 247, 228, 0.3);
}

.popup-container--home .status-label,
.popup-container--home .mcp-config-label,
.popup-container--home .port-label {
  color: var(--popup-muted);
}

.popup-container--home .status-banner {
  display: flex;
  min-height: 60px;
  gap: 10px;
  padding: 3px;
  border: 0;
  background: transparent;
}

.popup-container--home .status-banner.bg-green-subtle {
  background: transparent;
}

.popup-container--home .status-symbol {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #65e2bc, #16c995);
  box-shadow: 0 6px 15px rgba(22, 201, 149, 0.24);
  font-size: 21px;
}

.popup-container--home .status-symbol.bg-red-subtle {
  background: linear-gradient(145deg, #ff9eaa, #ef4765);
  box-shadow: 0 6px 15px rgba(239, 71, 101, 0.2);
}

.popup-container--home .status-symbol.bg-yellow-subtle {
  background: linear-gradient(145deg, #ffd17b, #f2a52b);
  box-shadow: 0 6px 15px rgba(242, 165, 43, 0.2);
}

.popup-container--home :deep(.status-symbol .popup-icon) {
  filter: brightness(0) invert(1);
}

.popup-container--home .status-dot {
  display: none;
}

.popup-container--home .status-copy {
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  gap: 2px;
}

.popup-container--home .status-label {
  font-size: 11px;
  line-height: 1.2;
}

.popup-container--home .status-text {
  color: #153451;
  font-size: 15px;
  line-height: 1.35;
}

.popup-container--home .status-description {
  color: #647b9e;
  font-size: 10px;
  line-height: 1.3;
}

.popup-container--home .status-meta {
  display: grid;
  grid-template-columns: 14px 1fr;
  align-content: center;
  column-gap: 5px;
  min-width: 72px;
  padding-left: 9px;
  border-left: 1px solid rgba(95, 124, 158, 0.24);
  color: var(--popup-muted);
  font-size: 9px;
  line-height: 1.25;
}

.popup-container--home .status-meta .popup-icon {
  grid-row: 1 / span 2;
  width: 14px;
  height: 14px;
}

.popup-container--home .status-meta time {
  grid-column: 2;
  color: var(--popup-ink);
  font-size: 12px;
}

.popup-container--home .refresh-status-button {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  align-self: center;
  margin-left: 1px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.28);
  color: #0aa87f;
}

.popup-container--home .status-timestamp {
  color: #617696;
  font-size: 10px;
}

.popup-container--home .package-versions {
  color: var(--popup-muted);
  font-size: 10px;
}

.popup-container--home .service-warning {
  border-color: rgba(245, 158, 11, 0.26);
  border-radius: 15px;
  background: rgba(255, 251, 235, 0.94);
}

.popup-container--home .service-warning-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 12px;
  background: #fff0c9;
}

.popup-container--home .service-warning-icon-glyph {
  font-size: 22px;
}

.popup-container--home .mcp-config-section {
  border-top: 0;
  margin-bottom: 0;
  padding-top: 2px;
}

.popup-container--home .mcp-config-header {
  display: flex;
  justify-content: space-between;
}

.popup-container--home .mcp-config-header {
  align-items: center;
  margin-bottom: 8px;
}

.popup-container--home .mcp-config-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.popup-container--home .mcp-config-heading > .popup-icon {
  width: 28px;
  height: 28px;
}

.popup-container--home .mcp-config-heading > div {
  display: grid;
  gap: 2px;
}

.popup-container--home .mcp-config-heading span {
  color: var(--popup-muted);
  font-size: 10px;
  line-height: 1.3;
}

.popup-container--home .copy-config-button {
  min-height: 34px;
  justify-content: center;
  gap: 6px;
  padding: 6px 11px;
  border: 1px solid rgba(139, 92, 246, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: #6544cf;
  font-size: 12px;
}

.popup-container--home .copy-config-button:hover:not(:disabled) {
  border-color: rgba(139, 92, 246, 0.5);
  background: #f4edff;
  color: #5b21b6;
}

.popup-container--home :deep(.copy-config-button .popup-icon) {
  width: 17px;
  height: 17px;
}

.popup-container--home .mcp-transport-options {
  gap: 0;
  padding-top: 8px;
}

.popup-container--home .mcp-transport-option {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 12px;
  grid-template-areas:
    'icon title arrow'
    'icon endpoint arrow'
    'icon description arrow';
  align-items: center;
  gap: 2px 9px;
  min-height: 50px;
  margin-top: -9px;
  padding: 6px 9px;
  border-color: rgba(207, 211, 230, 0.66);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.32);
  color: var(--popup-ink);
  transition:
    min-height 220ms ease,
    padding 220ms ease,
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.popup-container--home .mcp-transport-option:first-child {
  margin-top: 0;
}

.popup-container--home .mcp-transport-option:hover {
  border-color: rgba(139, 92, 246, 0.42);
  background: rgba(255, 255, 255, 0.48);
}

.popup-container--home .mcp-transport-option--selected {
  border: 1px solid #a855f7;
  background: linear-gradient(110deg, rgba(252, 247, 255, 0.44), rgba(255, 255, 255, 0.38));
  box-shadow:
    inset 4px 0 0 #a855f7,
    0 5px 16px rgba(168, 85, 247, 0.12);
}

.popup-container--home .mcp-transport-option--expanded {
  z-index: 2;
  min-height: 86px;
  padding-block: 8px;
}

.popup-container--home .mcp-transport-option-icon {
  grid-area: icon;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: #e4edff;
  color: #3678ed;
  font-size: 27px;
}

.popup-container--home .mcp-transport-option:nth-child(2) .mcp-transport-option-icon {
  background: #f0e3ff;
  color: #793be5;
}

.popup-container--home .mcp-transport-option:nth-child(3) .mcp-transport-option-icon {
  background: #fff0da;
  color: #e89a25;
}

.popup-container--home .mcp-transport-option:nth-child(4) .mcp-transport-option-icon {
  background: #dcf7ec;
  color: #13a773;
}

.popup-container--home .mcp-transport-option-header {
  grid-area: title;
  min-width: 0;
}

.popup-container--home .mcp-transport-option--expanded .mcp-transport-option-icon {
  width: 36px;
  height: 36px;
}

.popup-container--home .mcp-transport-option-title {
  overflow: hidden;
  color: #182c51;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popup-container--home .mcp-transport-option-selected {
  padding: 3px 7px;
  background: #8b35e9;
  color: white;
}

.popup-container--home .mcp-transport-option-endpoint {
  grid-area: endpoint;
  display: none;
  min-width: 0;
  overflow: hidden;
  padding: 4px 6px;
  border: 1px solid rgba(215, 218, 238, 0.9);
  border-radius: 8px;
  background: rgba(246, 247, 253, 0.48);
  color: #31466e;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popup-container--home .mcp-transport-option-description {
  grid-area: description;
  display: none;
  color: var(--popup-muted);
  font-size: 10px;
}

.popup-container--home .mcp-transport-option--expanded .mcp-transport-option-endpoint,
.popup-container--home .mcp-transport-option--expanded .mcp-transport-option-description {
  display: block;
}

.popup-container--home .mcp-transport-option-arrow {
  grid-area: arrow;
  width: 12px;
  height: 12px;
  align-self: center;
  opacity: 0.75;
}

.popup-container--home .mcp-config-content,
.popup-container--home .port-input-wrapper {
  border-color: rgba(205, 211, 230, 0.9);
  border-radius: 11px;
  background: rgba(248, 249, 255, 0.38);
}

.popup-container--home .mcp-config-content {
  display: none;
}

.popup-container--home .mcp-config-json,
.popup-container--home .port-prefix,
.popup-container--home .port-input {
  color: #2c4168;
}

.popup-container--home .connect-button {
  min-height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 13px;
  background: linear-gradient(110deg, #8742ef, #ad54eb);
  box-shadow: 0 7px 16px rgba(139, 92, 246, 0.25);
}

.popup-container--home .connect-button:hover:not(:disabled) {
  background: linear-gradient(110deg, #7430df, #9942de);
}

.popup-container--home .connection-group,
.popup-container--home .proxy-live-status {
  border-color: rgba(105, 117, 151, 0.17);
}

.popup-container--home .proxy-live-status {
  margin-top: 0;
  background: rgba(250, 249, 255, 0.3);
}

.popup-container--home .proxy-live-status-header,
.popup-container--home .proxy-live-location,
.popup-container--home .proxy-live-placeholder {
  color: #526789;
}

.popup-container--home .extension-id {
  padding: 10px 12px;
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.42);
  color: #354b74;
  font-size: 11px;
}

.popup-subsection-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 3px 1px 0;
  color: #7040ce;
  font-size: 17px;
}

.popup-subsection-heading > div {
  display: grid;
  gap: 2px;
}

.popup-subsection-heading strong {
  color: var(--popup-ink);
}

.popup-subsection-heading small {
  color: var(--popup-muted);
  font-size: 10px;
  font-weight: 400;
}

.popup-subsection-heading--nested {
  margin-top: 2px;
}

.popup-subsection-heading--nested > div {
  gap: 2px;
}

.popup-container--home .background-operations-switch {
  min-height: 54px;
  gap: 10px;
  margin: 0;
  padding: 9px 11px;
  border: 1px solid rgba(216, 218, 235, 0.8);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.32);
  color: var(--popup-ink);
}

.popup-container--home .background-operations-switch strong {
  font-size: 13px;
}

.popup-container--home .background-operations-switch small {
  color: var(--popup-muted);
  font-size: 10px;
  line-height: 1.35;
}

.popup-container--home .background-operations-switch input[type='checkbox'] {
  position: relative;
  width: 40px;
  height: 24px;
  flex: 0 0 40px;
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: #b8c0d1;
  cursor: pointer;
  transition: background 160ms ease;
}

.popup-container--home .background-operations-switch input[type='checkbox']::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(31, 41, 55, 0.22);
  content: '';
  transition: transform 160ms ease;
}

.popup-container--home .background-operations-switch input[type='checkbox']:checked {
  background: linear-gradient(110deg, #8b45ed, #bc55ec);
}

.popup-container--home .background-operations-switch input[type='checkbox']:checked::after {
  transform: translateX(16px);
}

.popup-container--home .background-operations-switch input[type='checkbox']:focus-visible {
  outline: 2px solid #702fe0;
  outline-offset: 3px;
}

.popup-container--home .timeout-input input {
  min-height: 34px;
  border-color: rgba(205, 211, 230, 0.94);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.58);
}

.popup-container--home .proxy-quick-actions {
  padding: 2px;
}

.popup-container--home .proxy-quick-actions .copy-config-button {
  width: 100%;
  min-height: 43px;
  border-radius: 14px;
  font-weight: 650;
}

.popup-container--home .quick-tools-unlock-trigger {
  width: auto;
  cursor: pointer;
}

.popup-container--home .rr-icon-buttons {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 7px 8px;
}

.popup-container--home .rr-icon-btn {
  width: auto;
  min-width: 0;
  min-height: 76px;
  height: auto;
  flex-direction: column;
  gap: 5px;
  padding: 5px 2px;
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(235, 241, 255, 0.96), rgba(224, 232, 255, 0.9));
  color: #2d66dc;
  font-size: 9px;
  font-weight: 650;
  line-height: 1.2;
}

.popup-container--home .rr-icon-btn:nth-child(2) {
  background: linear-gradient(145deg, #e4fbf3, #d2f5e9);
  color: #0e9b72;
}

.popup-container--home .rr-icon-btn:nth-child(3) {
  background: linear-gradient(145deg, #f5eaff, #eddcff);
  color: #7b35da;
}

.popup-container--home .rr-icon-btn:nth-child(4) {
  background: linear-gradient(145deg, #ffeaf0, #ffdde7);
  color: #e64271;
}

.popup-container--home .rr-icon-btn:nth-child(5) {
  background: linear-gradient(145deg, #fff2dc, #ffe8c9);
  color: #d98517;
}

.popup-container--home .rr-icon-btn:nth-child(6) {
  background: linear-gradient(145deg, #ffe9ed, #ffdce3);
  color: #d9335d;
}

.popup-container--home :deep(.rr-icon-btn .popup-icon) {
  width: 27px;
  height: 27px;
}

.popup-container--home .rr-icon-btn:hover:not(:disabled) {
  border-color: rgba(139, 92, 246, 0.38);
  box-shadow: 0 5px 14px rgba(87, 60, 137, 0.12);
  transform: translateY(-1px);
}

.popup-container--home .rr-icon-btn:disabled {
  filter: grayscale(0.55);
  opacity: 0.5;
}

.popup-container--home .quick-tools-help {
  margin: 8px 1px 0;
  padding: 10px 11px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.36);
  color: var(--popup-muted);
  font-size: 11px;
}

.popup-container--home .entry-card {
  padding: 7px;
}

.popup-container--home .entry-item {
  min-height: 67px;
  gap: 10px;
  margin: 0 0 6px;
  padding: 8px 9px;
  border: 1px solid rgba(217, 220, 238, 0.78);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.3);
}

.popup-container--home .entry-item:last-child {
  margin-bottom: 0;
}

.popup-container--home .entry-item:hover {
  border-color: rgba(139, 92, 246, 0.42);
  background: rgba(255, 255, 255, 0.5);
}

.popup-container--home .entry-icon {
  width: 43px;
  height: 43px;
  border-radius: 14px;
  font-size: 25px;
}

.popup-container--home .entry-icon.agent {
  background: #ffe7f0;
  color: #e83a83;
}

.popup-container--home .entry-icon.workflow {
  background: #eee2ff;
  color: #7939e1;
}

.popup-container--home .entry-icon.marker {
  background: #dbf8ed;
  color: #119c70;
}

.popup-container--home .entry-icon.model {
  background: #fff0d9;
  color: #dc8c1b;
}

.popup-container--home .entry-icon.tools {
  background: #e1edff;
  color: #3b72e8;
}

.popup-container--home .entry-icon.recordings {
  background: #f2e5ff;
  color: #8c42db;
}

.popup-container--home :deep(.entry-icon .popup-icon) {
  width: 25px;
  height: 25px;
}

.popup-container--home .entry-title {
  color: var(--popup-ink);
  font-size: 13px;
}

.popup-container--home .entry-desc {
  color: var(--popup-muted);
  font-size: 10px;
}

.popup-container--home .entry-arrow {
  width: 12px;
  height: 12px;
  opacity: 0.75;
}

.popup-container--home .footer {
  flex: 0 0 auto;
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.66);
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(5px);
}

.popup-container--home .footer-links {
  gap: 9px;
  margin-bottom: 6px;
}

.popup-container--home .footer-link {
  min-width: 104px;
  min-height: 35px;
  justify-content: center;
  gap: 7px;
  border: 1px solid rgba(255, 255, 255, 0.86);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  color: var(--popup-ink);
  font-size: 12px;
}

.popup-container--home :deep(.footer-link .popup-icon) {
  width: 18px;
  height: 18px;
}

.popup-container--home .footer-link:hover {
  background: #fff;
  color: #6d35db;
}

.popup-container--home .footer-text {
  color: #8492ae;
  font-size: 9px;
  letter-spacing: 1.8px;
}

.popup-container.popup-container--premium {
  --ac-bg: rgba(255, 255, 255, 0.12);
  --ac-surface: rgba(255, 255, 255, 0.52);
  --ac-surface-muted: rgba(255, 255, 255, 0.38);
  --ac-border: rgba(255, 255, 255, 0.72);
  --ac-text: #182c51;
  --ac-text-muted: #526789;
  --ac-text-subtle: #637797;
  --ac-accent: #7c3aed;
  --ac-accent-hover: #6d32d1;
  --ac-accent-subtle: rgba(139, 92, 246, 0.14);
  --ac-radius-card: 16px;
  --ac-radius-button: 12px;
  --ac-shadow-card: 0 8px 22px rgba(47, 38, 76, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.72);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 248, 253, 0.25)),
    url('/assets/backgrounds/popup-subpage-catgirl.webp') center 34% / cover !important;
  box-shadow:
    0 20px 48px rgba(54, 42, 82, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.16);
}

.popup-container--premium :deep(.local-model-page),
.popup-container--premium :deep(.mcp-tools-page) {
  color: var(--ac-text);
  background: transparent !important;
}

.popup-container--premium :deep(.page-header) {
  flex: 0 0 auto;
  margin: 8px 10px 0;
  padding: 9px 11px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.38) !important;
  box-shadow: 0 7px 22px rgba(53, 42, 82, 0.1);
  backdrop-filter: blur(14px) saturate(125%);
}

.popup-container--premium :deep(.page-title) {
  color: var(--ac-text);
  font-size: 16px;
  font-weight: 750;
}

.popup-container--premium :deep(.page-content) {
  padding: 13px 12px 18px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(2px);
}

.popup-container--premium :deep(.back-button),
.popup-container--premium :deep(.language-toggle) {
  min-height: 36px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.42);
  color: #493a76;
  box-shadow: 0 3px 10px rgba(67, 53, 99, 0.08);
  backdrop-filter: blur(8px);
}

.popup-container--premium :deep(.back-button:hover),
.popup-container--premium :deep(.language-toggle:hover) {
  border-color: rgba(139, 92, 246, 0.48);
  background: rgba(255, 255, 255, 0.62);
  color: #6d35db;
}

.popup-container--premium :deep(.semantic-engine-card),
.popup-container--premium :deep(.model-card),
.popup-container--premium :deep(.stats-card),
.popup-container--premium :deep(.tool-card) {
  border-color: rgba(255, 255, 255, 0.74);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.48) !important;
  box-shadow: 0 8px 22px rgba(49, 39, 76, 0.11);
  backdrop-filter: blur(10px) saturate(120%);
}

.popup-container--premium :deep(.model-card.selected),
.popup-container--premium :deep(.tool-card[open]) {
  border-color: rgba(139, 92, 246, 0.72);
  background: rgba(249, 243, 255, 0.68) !important;
  box-shadow: 0 8px 22px rgba(125, 71, 194, 0.16);
}

.popup-container--premium :deep(.section-title),
.popup-container--premium :deep(.tool-group h3) {
  color: var(--ac-text);
}

.popup-container--premium :deep(.tool-search) {
  min-height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.62);
  color: var(--ac-text);
  box-shadow: 0 4px 14px rgba(49, 39, 76, 0.08);
  backdrop-filter: blur(8px);
}

.popup-container--premium :deep(.tool-search:focus) {
  border-color: rgba(124, 58, 237, 0.68);
  outline: 2px solid rgba(124, 58, 237, 0.22);
  outline-offset: 1px;
}

.popup-container--premium :deep(.tool-params) {
  border-color: rgba(128, 112, 159, 0.18);
  background: rgba(255, 255, 255, 0.2);
}

.popup-container--premium :deep(.error-card) {
  border-color: rgba(239, 71, 101, 0.3);
  background: rgba(255, 242, 246, 0.82);
  backdrop-filter: blur(8px);
}

.popup-container--home .subpage-modal,
.popup-container--premium .subpage-modal {
  background: rgba(50, 38, 73, 0.24);
  backdrop-filter: blur(7px) saturate(110%);
}

.popup-container--home .subpage-modal .error-log-dialog,
.popup-container--premium .subpage-modal .error-log-dialog {
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.68), rgba(255, 250, 255, 0.76)),
    url('/assets/backgrounds/popup-subpage-catgirl.webp') center 34% / cover;
  box-shadow:
    0 20px 48px rgba(43, 32, 68, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  color: #182c51;
  backdrop-filter: blur(16px) saturate(120%);
}

.popup-container--home .subpage-modal .error-log-header,
.popup-container--premium .subpage-modal .error-log-header {
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(93, 78, 125, 0.16);
  color: #182c51;
}

.popup-container--home .subpage-modal .proxy-description,
.popup-container--home .subpage-modal .cookie-selected-count,
.popup-container--premium .subpage-modal .proxy-description,
.popup-container--premium .subpage-modal .cookie-selected-count {
  color: #526789;
}

.popup-container--home .subpage-modal .proxy-form input:not([type='checkbox']),
.popup-container--home .subpage-modal .proxy-form textarea,
.popup-container--home .subpage-modal .proxy-form select,
.popup-container--premium .subpage-modal .proxy-form input:not([type='checkbox']),
.popup-container--premium .subpage-modal .proxy-form textarea,
.popup-container--premium .subpage-modal .proxy-form select {
  border-color: rgba(133, 119, 163, 0.26);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: #243a60;
}

.popup-container--home .subpage-modal .cookie-tab-card,
.popup-container--home .subpage-modal .recent-script-item,
.popup-container--home .subpage-modal .proxy-ip-change,
.popup-container--premium .subpage-modal .cookie-tab-card,
.popup-container--premium .subpage-modal .recent-script-item,
.popup-container--premium .subpage-modal .proxy-ip-change {
  border-color: rgba(255, 255, 255, 0.76);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: 0 5px 16px rgba(49, 39, 76, 0.08);
  backdrop-filter: blur(8px);
}

.popup-container--home .subpage-modal .cookie-tab-title strong,
.popup-container--home .subpage-modal .recent-script-info strong,
.popup-container--premium .subpage-modal .cookie-tab-title strong,
.popup-container--premium .subpage-modal .recent-script-info strong {
  color: #182c51;
}

@media (max-width: 360px) {
  .popup-container--home .header-title {
    font-size: 15px;
  }

  .header-caption {
    font-size: 7px;
    letter-spacing: 1.3px;
  }

  .popup-container--home .content {
    padding-right: 9px;
    padding-left: 9px;
  }

  .popup-container--home .rr-icon-buttons {
    gap: 4px;
    padding-right: 5px;
    padding-left: 5px;
  }

  .popup-container--home .rr-icon-btn {
    font-size: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .popup-container--home .content {
    scroll-behavior: auto;
  }

  .popup-container--home .mcp-transport-option {
    transition: none;
  }
}
</style>
