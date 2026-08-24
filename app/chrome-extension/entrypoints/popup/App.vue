<template>
  <div class="popup-container agent-theme" :data-agent-theme="agentTheme">
    <!-- 首页 -->
    <div v-show="currentView === 'home'" class="home-view">
      <div class="header">
        <div class="header-content">
          <h1 class="header-title">猫娘 Chrome MCP Server</h1>
          <img class="header-logo" :src="extensionLogoUrl" alt="" />
        </div>
      </div>
      <div ref="homeContentRef" class="content">
        <!-- 服务配置卡片 -->
        <div class="section">
          <h2 class="section-title">{{ getMessage('nativeServerConfigLabel') }}</h2>
          <div class="config-card">
            <div class="status-section">
              <div class="status-header">
                <p class="status-label">{{ getMessage('runningStatusLabel') }}</p>
                <button
                  class="refresh-status-button"
                  @click="refreshServerStatus"
                  :title="getMessage('refreshStatusButton')"
                >
                  <RefreshIcon className="icon-small" />
                </button>
              </div>
              <div :class="['status-banner', getStatusBgClass()]">
                <span :class="['status-dot', getStatusDotClass()]"></span>
                <span class="status-text">{{ getStatusText() }}</span>
                <div v-if="serverStatus.lastUpdated" class="status-timestamp">
                  {{ getMessage('lastUpdatedLabel') }}
                  {{ new Date(serverStatus.lastUpdated).toLocaleTimeString() }}
                </div>
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
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="#d97706"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
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

            <div v-if="showMcpConfig" class="mcp-config-section">
              <div class="mcp-config-header">
                <p class="mcp-config-label">{{ getMessage('mcpServerConfigLabel') }}</p>
                <button class="copy-config-button" @click="copyMcpConfig">
                  {{ copyButtonText }}
                </button>
              </div>
              <div class="mcp-config-content">
                <pre class="mcp-config-json">{{ mcpConfigJson }}</pre>
              </div>
            </div>

            <!-- 端口与连接 -->
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
                <BoltIcon />
                <span>{{
                  isConnecting
                    ? getMessage('connectingStatus')
                    : nativeConnectionStatus === 'connected'
                      ? getMessage('disconnectButton')
                      : getMessage('connectButton')
                }}</span>
              </button>
            </div>
            <div class="extension-id">扩展 ID: {{ extensionId }}</div>
            <label class="background-operations-switch">
              <span>
                <strong>后台操作</strong>
                <small>打开页面和自动化操作时不抢占前台</small>
              </span>
              <input
                v-model="backgroundOperations"
                type="checkbox"
                @change="saveBackgroundOperations"
              />
            </label>
            <label class="background-operations-switch">
              <span>
                <strong>发送滚动坐标</strong>
                <small>在页面编辑器左下角悬浮窗显示页面 X/Y 坐标</small>
              </span>
              <input
                v-model="sendScrollCoordinates"
                type="checkbox"
                @change="saveScrollCoordinatesSetting"
              />
            </label>
            <label class="background-operations-switch">
              <span>
                <strong>住宅代理</strong>
                <small>{{
                  proxy.enabled ? '已启用，当前 Chrome 配置文件流量将走代理' : '已关闭'
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
                @click="rotateCurrentProxy"
              >
                {{ proxySaving ? '正在处理…' : '手动切换当前页 IP' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 快捷工具卡片 -->
        <div class="section">
          <h2 class="section-title">快捷工具</h2>
          <div class="rr-icon-buttons">
            <button
              class="rr-icon-btn rr-icon-btn-edit has-tooltip"
              @click="toggleWebEditor"
              data-tooltip="页面编辑：可视化调整元素，并将选中元素交给助手修改"
            >
              <EditIcon />
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-marker has-tooltip"
              @click="toggleElementMarker"
              data-tooltip="元素标注：保存关键元素，供 MCP 读取与助手定位"
            >
              <MarkerIcon />
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-logs has-tooltip"
              @click="openErrorLogs"
              data-tooltip="查看错误日志"
            >
              <ErrorLogIcon />
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-record has-tooltip"
              :disabled="rrRecording"
              @click="startRecording"
              data-tooltip="开始录制（Ctrl+Shift+1）"
            >
              <RecordIcon :recording="rrRecording" />
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-pause has-tooltip"
              :disabled="!rrRecording"
              @click="togglePauseRecording"
              :data-tooltip="rrPaused ? '继续录制（Ctrl+Shift+2）' : '暂停录制（Ctrl+Shift+2）'"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
              </svg>
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-stop has-tooltip"
              :disabled="!rrRecording"
              @click="stopRecording"
              data-tooltip="停止录制（Ctrl+Shift+3）"
            >
              <StopIcon />
            </button>
          </div>
          <p class="quick-tools-help"
            >页面编辑用于可视化调整与精确提问；元素标注用于保存页面关键元素，供 MCP 和助手复用。</p
          >
          <p v-if="rrError" class="quick-tools-error">{{ rrError }}</p>
        </div>

        <!-- 管理入口卡片 -->
        <div class="section">
          <h2 class="section-title">管理入口</h2>
          <div class="entry-card">
            <button class="entry-item" @click="openAgentSidepanel">
              <div class="entry-icon agent">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div class="entry-content">
                <span class="entry-title">智能助手</span>
                <span class="entry-desc">AI Agent 对话与任务</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="openWorkflowSidepanel">
              <div class="entry-icon workflow">
                <WorkflowIcon />
              </div>
              <div class="entry-content">
                <span class="entry-title"> 工作流管理 </span>
                <span class="entry-desc">录制与回放自动化流程</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="openElementMarkerSidepanel">
              <div class="entry-icon marker">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <div class="entry-content">
                <span class="entry-title">元素标注管理</span>
                <span class="entry-desc">管理页面元素标注</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="currentView = 'local-model'">
              <div class="entry-icon model">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div class="entry-content">
                <span class="entry-title">本地模型</span>
                <span class="entry-desc">语义引擎与模型管理</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="currentView = 'mcp-tools'">
              <div class="entry-icon tools">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 6h16M4 12h16M4 18h10"
                  />
                </svg>
              </div>
              <div class="entry-content">
                <span class="entry-title">MCP 工具一览</span>
                <span class="entry-desc">查询可用工具与参数</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="openProxySettings">
              <div class="entry-icon tools">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path
                    stroke-linecap="round"
                    d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"
                  />
                </svg>
              </div>
              <div class="entry-content">
                <span class="entry-title">住宅代理</span>
                <span class="entry-desc">配置代理与页面异常自动轮换</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="openCookieManager">
              <div class="entry-icon tools">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="8.5" />
                  <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
                  <circle cx="11" cy="15" r="1" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <div class="entry-content">
                <span class="entry-title">Cookie 管理</span>
                <span class="entry-desc">查看并选择清除所有网页标签页 Cookie</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="openRecentRecordedScripts">
              <div class="entry-icon recordings">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M14 2v6h6M8 13h8M8 17h5"
                  />
                </svg>
              </div>
              <div class="entry-content">
                <span class="entry-title">最近录制脚本</span>
                <span class="entry-desc">查询、打开或复制页面录制流程</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-links">
          <button class="footer-link" @click="openWelcomePage" title="View installation guide">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Guide
          </button>
          <button class="footer-link" @click="openTroubleshooting" title="Troubleshooting">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Docs
          </button>
        </div>
        <p class="footer-text">chrome mcp server for anything</p>
      </div>
    </div>

    <div v-if="showErrorLogs" class="error-log-modal" @click.self="showErrorLogs = false">
      <section class="error-log-dialog" role="dialog" aria-modal="true" aria-label="错误日志">
        <header class="error-log-header">
          <strong>错误日志</strong>
          <button class="copy-config-button" @click="showErrorLogs = false">关闭</button>
        </header>
        <textarea readonly class="error-log-content" :value="errorLogText"></textarea>
        <footer class="error-log-actions">
          <button class="copy-config-button" @click="copyErrorLogs">{{ errorLogCopyLabel }}</button>
          <button
            class="copy-config-button"
            :disabled="isExportingErrorLogs"
            @click="exportErrorLogs"
          >
            {{ isExportingErrorLogs ? '正在导出…' : '导出 JSON' }}
          </button>
          <button class="copy-config-button" @click="clearErrorLogs">清空日志</button>
        </footer>
      </section>
    </div>

    <div v-if="showProxyModal" class="error-log-modal" @click.self="showProxyModal = false">
      <section
        class="error-log-dialog proxy-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="住宅代理"
      >
        <header class="error-log-header">
          <strong>住宅代理</strong>
          <button class="copy-config-button" @click="showProxyModal = false">关闭</button>
        </header>
        <p class="proxy-description"
          >反向入口使用 <code>pr.oxylabs.io:7777</code> +
          <code>cc-XX</code>；具体国家入口使用对应国家主机和端口，用户名不带
          <code>cc</code>。插件会按站点保持同一出口，未指定 <code>sesstime</code> 时默认约 5
          分钟；需要更长粘性时可加 <code>sesstime-60</code>。</p
        >
        <div class="proxy-form">
          <label class="proxy-toggle"
            ><span>启用代理</span><input v-model="proxy.enabled" type="checkbox"
          /></label>
          <label
            >端点类型<select v-model="proxy.endpointType"
              ><option value="reverse">反向连接入口（7777）</option
              ><option value="country">具体国家/地区入口</option></select
            ></label
          >
          <label v-if="proxy.endpointType === 'reverse'"
            >接入地区<select v-model="proxy.accessRegion"
              ><option value="global">全球（pr.oxylabs.io:7777）</option
              ><option value="beijing">北京（cnt9t1is.com:8000）</option
              ><option value="hongkong">香港（a81298871.com:8000）</option
              ><option value="custom">自定义地址</option></select
            ></label
          >
          <label
            >输出格式 / 连接协议<select v-model="proxy.protocol"
              ><option value="http">端点：端口 / HTTP</option
              ><option value="https">HTTPS（北京/香港入口必选）</option
              ><option value="socks5" disabled>SOCKS5（Oxylabs 不支持 Chrome）</option></select
            ></label
          >
          <label
            >代理地址或完整连接串<input
              v-model="proxy.host"
              placeholder="customer-USER:PASSWORD@pr.oxylabs.io:7777"
          /></label>
          <label>端口<input v-model.number="proxy.port" type="number" min="1" max="65535" /></label>
          <label
            >用户名<input v-model="proxy.username" placeholder="customer-USERNAME-cc-us"
          /></label>
          <label
            >国家/地区{{ proxy.endpointType === 'country' ? '' : '（可选）'
            }}<select v-model="proxy.countryCode"
              ><option v-if="proxy.endpointType === 'reverse'" value="">不指定（保留用户名）</option
              ><option v-if="proxy.endpointType === 'reverse'" value="random"
                >随机（移除 cc）</option
              ><option v-for="country in PROXY_COUNTRIES" :key="country.code" :value="country.code"
                >{{ country.name
                }}{{
                  proxy.endpointType === 'reverse'
                    ? `（cc-${country.code}）`
                    : `（${country.code}-pr.oxylabs.io:${proxy.protocol === 'https' ? country.httpsPort : country.httpPort}）`
                }}</option
              ></select
            ></label
          >
          <label
            >密码<input v-model="proxy.password" type="password" autocomplete="new-password"
          /></label>
          <label>会话 ID（可选）<input v-model="proxy.sessionId" placeholder="0366443321" /></label>
          <label class="proxy-toggle"
            ><span>页面异常自动轮换 IP（同站点最短 5 分钟，不设每小时次数上限）</span
            ><input v-model="proxy.rotateOnError" type="checkbox"
          /></label>
          <label
            >仅对这些网站走代理（留空表示全部网站）<textarea
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
            >手动切换 IP</button
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="proxySaving"
            @click="() => saveProxySettings()"
            >保存</button
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="proxySaving"
            @click="testProxyConnection"
            >测试连接</button
          >
        </footer>
      </section>
    </div>

    <div v-if="showCookieModal" class="error-log-modal" @click.self="showCookieModal = false">
      <section
        class="error-log-dialog cookie-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="所有标签页 Cookie"
      >
        <header class="error-log-header">
          <strong>所有标签页 Cookie</strong>
          <button class="copy-config-button" type="button" @click="showCookieModal = false"
            >关闭</button
          >
        </header>
        <p class="proxy-description"
          >选择任意网页标签页，再勾选要清除的 Cookie；未勾选的 Cookie 会保留。仅处理
          <code>http/https</code> 网页标签，不显示 Cookie 值。</p
        >
        <div class="cookie-toolbar">
          <button
            class="copy-config-button"
            type="button"
            :disabled="cookieLoading || cookieSaving || !cookieCount"
            @click="selectAllCookies(true)"
            >全选</button
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="cookieLoading || cookieSaving"
            @click="selectAllCookies(false)"
            >全不选</button
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="cookieLoading || cookieSaving || !cookieCount"
            @click="invertAllCookies"
            >反选</button
          >
          <button
            class="copy-config-button"
            type="button"
            :disabled="cookieLoading || cookieSaving"
            @click="loadAllCookieTabs"
            >刷新</button
          >
          <span class="cookie-selected-count">已选 {{ selectedCookieCount }} 个</span>
        </div>
        <div v-if="cookieLoading" class="cookie-empty">正在读取所有网页标签页的 Cookie…</div>
        <div v-else-if="!cookieTabs.length" class="cookie-empty"
          >当前没有可读取 Cookie 的网页标签页。</div
        >
        <div v-else class="cookie-tabs-list">
          <article v-for="tab in cookieTabs" :key="tab.id" class="cookie-tab-card">
            <div class="cookie-tab-header">
              <div class="cookie-tab-title">
                <strong>{{ tab.active ? '当前' : '标签页' }} · {{ tab.title || tab.url }}</strong>
                <span>{{ tab.url }}</span>
              </div>
              <div class="cookie-tab-actions">
                <button
                  class="copy-config-button"
                  type="button"
                  :disabled="tab.loading || cookieSaving || !tab.cookies.length"
                  @click="setTabCookiesSelected(tab, true)"
                  >全选</button
                >
                <button
                  class="copy-config-button"
                  type="button"
                  :disabled="tab.loading || cookieSaving || !tab.cookies.length"
                  @click="invertTabCookies(tab)"
                  >反选</button
                >
                <button
                  class="copy-config-button"
                  type="button"
                  :disabled="tab.loading || cookieSaving"
                  @click="loadCookiesForTab(tab)"
                  >刷新</button
                >
              </div>
            </div>
            <p v-if="tab.loading" class="cookie-empty">正在读取…</p>
            <p v-else-if="tab.error" class="cookie-error">{{ tab.error }}</p>
            <p v-else-if="!tab.cookies.length" class="cookie-empty">没有匹配到 Cookie。</p>
            <div v-else class="cookie-list">
              <label v-for="entry in tab.cookies" :key="entry.key" class="cookie-row">
                <input v-model="entry.selected" type="checkbox" :disabled="cookieSaving" />
                <span class="cookie-info">
                  <strong>{{ entry.cookie.name }}</strong>
                  <small
                    >{{ entry.cookie.domain }}{{ entry.cookie.path }} ·
                    {{ entry.cookie.secure ? 'Secure' : '普通' }} ·
                    {{ entry.cookie.httpOnly ? 'HttpOnly' : '脚本可读' }} ·
                    {{ entry.cookie.session ? '会话' : '持久' }}</small
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
            >{{ cookieSaving ? '正在清除…' : `清除已选 ${selectedCookieCount} 个` }}</button
          >
          <button class="copy-config-button" type="button" @click="showCookieModal = false"
            >取消</button
          >
        </footer>
      </section>
    </div>

    <div
      v-if="showRecentRecordedScripts"
      class="error-log-modal"
      @click.self="showRecentRecordedScripts = false"
    >
      <section
        class="error-log-dialog recent-scripts-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="最近录制脚本"
      >
        <header class="error-log-header">
          <strong>最近录制的页面脚本</strong>
          <button class="copy-config-button" @click="showRecentRecordedScripts = false"
            >关闭</button
          >
        </header>
        <p v-if="recentRecordedFlows.length === 0" class="recent-scripts-empty"
          >暂无页面录制脚本。</p
        >
        <div v-else class="recent-scripts-list">
          <article v-for="flow in recentRecordedFlows" :key="flow.id" class="recent-script-item">
            <div class="recent-script-info">
              <strong>{{ flow.name }}</strong>
              <span>{{ formatRecordedFlowTime(flow.updatedAt || flow.createdAt) }}</span>
            </div>
            <div class="recent-script-actions">
              <button class="copy-config-button" @click="openBuilderWindow(flow.id)">打开</button>
              <button class="copy-config-button" @click="runRecordedScript(flow.id)">运行</button>
              <button
                class="copy-config-button danger-action"
                @click="deleteRecordedScript(flow.id)"
                >删除</button
              >
            </div>
          </article>
        </div>
        <p v-if="recentScriptsMessage" class="recent-scripts-message">{{ recentScriptsMessage }}</p>
      </section>
    </div>

    <!-- 本地模型二级页面 -->
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
      icon="⚠️"
      :confirm-text="getMessage('confirmClearButton')"
      :cancel-text="getMessage('cancelButton')"
      :confirming-text="getMessage('clearingStatus')"
      :is-confirming="isClearingData"
      @confirm="confirmClearAllData"
      @cancel="hideClearDataConfirmation"
    />

    <!-- 侧边栏承担工作流管理；编辑器在独立窗口中打开 -->

    <!-- Coming Soon Toast -->
    <Transition name="toast">
      <div v-if="comingSoonToast.show" class="coming-soon-toast">
        <svg
          class="toast-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ comingSoonToast.feature }} 功能开发中，敬请期待</span>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUpdate, onMounted, onUnmounted, onUpdated, reactive, ref } from 'vue';
import {
  PREDEFINED_MODELS,
  type ModelPreset,
  getModelInfo,
  getCacheStats,
  clearModelCache,
  cleanupModelCache,
} from '@/utils/semantic-similarity-engine';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { WEB_EDITOR_V3_ACTIONS } from '@/common/web-editor-types';
import { LINKS, PROXY_COUNTRIES, STORAGE_KEYS } from '@/common/constants';
import { getMessage } from '@/utils/i18n';
import { useRRV3Rpc } from '@/entrypoints/shared/composables';
import { useAgentTheme, type AgentThemeId } from '../sidepanel/composables/useAgentTheme';

import ConfirmDialog from './components/ConfirmDialog.vue';
import ProgressIndicator from './components/ProgressIndicator.vue';
import ModelCacheManagement from './components/ModelCacheManagement.vue';
import LocalModelPage from './components/LocalModelPage.vue';
import McpToolsPage from './components/McpToolsPage.vue';
import {
  DatabaseIcon,
  BoltIcon,
  TrashIcon,
  CheckIcon,
  TabIcon,
  VectorIcon,
  RecordIcon,
  StopIcon,
  WorkflowIcon,
  RefreshIcon,
  EditIcon,
  MarkerIcon,
  ErrorLogIcon,
} from './components/icons';

// AgentChat theme - 从preload中获取，保持与sidepanel一致
const { theme: agentTheme, initTheme } = useAgentTheme();
const rrRpc = useRRV3Rpc();

// 当前视图状态：首页 or 本地模型页
const currentView = ref<'home' | 'local-model' | 'mcp-tools'>('home');
const homeContentRef = ref<HTMLElement | null>(null);
let preservedHomeScrollTop = 0;

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
const proxyResult = ref('');
const proxyQuickResult = ref('');
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
const errorLogCopyLabel = ref('复制日志');
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
    : '暂无错误日志。',
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
    errorLogCopyLabel.value = '已复制';
  } catch {
    errorLogCopyLabel.value = '复制失败';
  }
  setTimeout(() => (errorLogCopyLabel.value = '复制日志'), 1500);
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
      (flow) => flow.meta?.tags?.includes('页面录制') || flow.description?.startsWith('录制自 '),
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

// Flow editor在独立窗口中打开；在popup不再展示繁杂列表

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
    recentScriptsMessage.value = '已开始运行录制脚本。';
  } catch (error) {
    recentScriptsMessage.value = error instanceof Error ? error.message : '运行脚本失败。';
  }
}

async function deleteRecordedScript(flowId: string) {
  if (!window.confirm('确定删除这条录制脚本吗？此操作无法撤销。')) return;
  try {
    await rrRpc.ensureConnected();
    await rrRpc.request('rr_v3.deleteFlow', { flowId });
    recentScriptsMessage.value = '录制脚本已删除。';
    await loadFlows();
  } catch (error) {
    recentScriptsMessage.value = error instanceof Error ? error.message : '删除脚本失败。';
  }
}

function formatRecordedFlowTime(value?: string) {
  return value ? new Date(value).toLocaleString() : '时间未知';
}

async function startRecording() {
  try {
    const result = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.RR_START_RECORDING,
    });
    if (!result?.success) {
      rrError.value = result?.error || '录制操作失败';
      return;
    }
    rrError.value = '';
    rrRecording.value = true;
    rrPaused.value = false;
  } catch (error) {
    rrError.value = error instanceof Error ? error.message : '无法连接录制服务';
  }
}

async function togglePauseRecording() {
  const result = await chrome.runtime.sendMessage({
    type: rrPaused.value
      ? BACKGROUND_MESSAGE_TYPES.RR_RESUME_RECORDING
      : BACKGROUND_MESSAGE_TYPES.RR_PAUSE_RECORDING,
  });
  if (!result?.success) return console.warn(result?.error || '录制操作失败');
  rrPaused.value = !rrPaused.value;
}

async function stopRecording() {
  const result = await chrome.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.RR_STOP_RECORDING,
  });
  if (!result?.success) return console.warn(result?.error || '停止录制失败');
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
      console.warn('回放失败');
      return;
    }
    // If failed, open builder and focus the failed node
    try {
      const result = res.result;
      if (result && result.success === false) {
        const logs = result.logs || [];
        const failed = logs.find((l: any) => l.status === 'failed');
        if (failed && failed.stepId) {
          // 打开独立编辑窗口并定位失败节点
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
    console.error('回放失败:', e);
  }
};

// 旧的“克隆/发布/定时/覆盖项”在侧边栏或编辑器中处理

const nativeConnectionStatus = ref<'unknown' | 'connected' | 'disconnected'>('unknown');
const isConnecting = ref(false);
const nativeServerPort = ref<number>(12306);
const backgroundOperations = ref(true);
const sendScrollCoordinates = ref(false);
const extensionId = chrome.runtime.id;
const extensionLogoUrl = chrome.runtime.getURL('icon/128.png');

const serverStatus = ref<{
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}>({
  isRunning: false,
  lastUpdated: Date.now(),
});
const packageVersions = ref<string | null>(null);

const showMcpConfig = computed(() => {
  return nativeConnectionStatus.value === 'connected' && serverStatus.value.isRunning;
});

const copyButtonText = ref(getMessage('copyConfigButton'));

const mcpConfigJson = computed(() => {
  const port = serverStatus.value.port || nativeServerPort.value;
  const config = {
    mcpServers: {
      'streamable-mcp-server': {
        type: 'streamable-http',
        url: `http://127.0.0.1:${port}/mcp`,
      },
    },
  };
  return JSON.stringify(config, null, 2);
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
    | { success?: boolean; pending?: boolean; ip?: string; country?: string; error?: string }
    | undefined;
  if (test?.pending) {
    proxyResult.value = '正在测试代理出口…';
  } else if (test?.success && test.ip) {
    proxyResult.value = `连接成功，出口 IP：${test.ip}${test.country ? `（国家/地区：${test.country}）` : ''}`;
  } else if (test?.error) {
    proxyResult.value = `错误：${test.error}`;
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
    if (!response?.success) throw new Error(response?.error || '保存失败');
    Object.assign(proxy, response.config);
    proxyDomains.value = (response.config.domains || []).join('\n');
    if (showResult) proxyResult.value = proxy.enabled ? '代理已启用' : '代理已停用';
    return true;
  } catch (error: any) {
    proxyResult.value = `错误：${error?.message || String(error)}`;
    return false;
  } finally {
    proxySaving.value = false;
  }
}

async function testProxyConnection() {
  proxyResult.value = '正在测试代理出口…';
  if (!(await saveProxySettings(false))) return;
  proxySaving.value = true;
  proxyResult.value = '正在测试代理出口…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'proxy_test' });
    if (!response?.success) throw new Error(response?.error || '测试失败');
    proxyResult.value = `连接成功，出口 IP：${response.ip}${response.country ? `（国家/地区：${response.country}）` : ''}`;
  } catch (error: any) {
    proxyResult.value = `错误：${error?.message || String(error)}`;
  } finally {
    proxySaving.value = false;
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
    if (!response?.success) throw new Error(response?.error || '切换失败');
    Object.assign(proxy, response.config);
    proxyQuickResult.value = enabled ? '代理已开启' : '代理已关闭';
  } catch (error: any) {
    proxy.enabled = previous;
    proxyQuickResult.value = `错误：${error?.message || String(error)}`;
  } finally {
    proxySaving.value = false;
  }
}

async function openProxySettings() {
  await loadProxySettings();
  showProxyModal.value = true;
}

async function rotateCurrentProxy() {
  if (proxySaving.value) return;
  proxySaving.value = true;
  proxyQuickResult.value = '正在为当前网页切换 IP…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) throw new Error('当前没有可切换代理的网页标签');
    const response = await chrome.runtime.sendMessage({
      type: 'proxy_rotate_current',
      tabId: tab.id,
      reason: '用户在插件中手动切换 IP',
    });
    if (!response?.success) throw new Error(response?.error || '切换 IP 失败');
    const result = response.result;
    if (!result?.rotated) {
      const reasons: Record<string, string> = {
        proxy_disabled: '代理未启用',
        rotation_in_progress: '该标签页正在切换中',
        rate_limited: '切换过于频繁，请稍后再试',
        outside_proxy_scope: '当前网页不在代理网站范围内',
      };
      throw new Error(reasons[result?.skipped] || '当前未切换 IP');
    }
    proxyQuickResult.value = '当前网页已切换 IP，页面正在重新加载。';
  } catch (error: any) {
    proxyQuickResult.value = `错误：${error?.message || String(error)}`;
  } finally {
    proxySaving.value = false;
  }
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
    tab.error = error?.message || '读取 Cookie 失败';
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
    cookieResult.value = `错误：${error?.message || String(error)}`;
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
  if (!window.confirm(`确定清除选中的 ${selected.length} 个 Cookie 吗？未选中的会保留。`)) return;

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
      ? `已清除 ${removed} 个，${failed} 个清除失败。`
      : `已清除 ${removed} 个 Cookie，未选中的 Cookie 已保留。`;
  } finally {
    cookieSaving.value = false;
  }
}

async function toggleWebEditor() {
  try {
    await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_TOGGLE });
  } catch (error) {
    console.warn('切换网页编辑模式失败:', error);
  }
}

async function toggleElementMarker() {
  try {
    // 获取当前活动tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn('无法获取当前tab');
      return;
    }

    // 向background发送消息，启动元素标注
    await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_START,
      tabId: tab.id,
    });
  } catch (error) {
    console.warn('开启元素标注失败:', error);
  }
}

async function openWelcomePage() {
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
    console.error('保存语义引擎状态失败:', error);
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
    console.error('检测 Native 连接状态失败:', error);
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
    console.error('检测服务器状态失败:', error);
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
    console.error('刷新服务器状态失败:', error);
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
    console.error('复制配置失败:', error);
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
      console.log(`尝试连接到端口: ${nativeServerPort.value}`);

      const response = await chrome.runtime.sendMessage({
        type: 'connectNative',
        port: nativeServerPort.value,
      });
      if (response && response.success) {
        nativeConnectionStatus.value = 'connected';
        console.log('连接成功:', response);
        await savePortPreference(nativeServerPort.value);
      } else {
        nativeConnectionStatus.value = 'disconnected';
        console.error('连接失败:', response);
      }
    }
  } catch (error) {
    console.error('测试连接失败:', error);
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
    console.error('❌ 加载模型偏好失败:', error);
  }
};

const saveModelPreference = async (model: ModelPreset) => {
  try {

    await chrome.storage.local.set({ selectedModel: model });
  } catch (error) {
    console.error('保存模型偏好失败:', error);
  }
};

const saveVersionPreference = async (version: 'full' | 'quantized' | 'compressed') => {
  try {

    await chrome.storage.local.set({ selectedVersion: version });
  } catch (error) {
    console.error('保存版本偏好失败:', error);
  }
};

const savePortPreference = async (port: number) => {
  try {

    await chrome.storage.local.set({ nativeServerPort: port });
    console.log(`端口偏好已保存: ${port}`);
  } catch (error) {
    console.error('保存端口偏好失败:', error);
  }
};

const loadPortPreference = async () => {
  try {

    const result = await chrome.storage.local.get(['nativeServerPort']);
    if (result.nativeServerPort) {
      nativeServerPort.value = result.nativeServerPort;
      console.log(`端口偏好已加载: ${result.nativeServerPort}`);
    }
  } catch (error) {
    console.error('加载端口偏好失败:', error);
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
    console.error('保存模型状态失败:', error);
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
      console.error('获取模型状态失败:', error);
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
        '模型切换成功:',
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
    console.error('模型切换失败:', error);
    modelSwitchProgress.value = `Model switch failed: ${error?.message || 'Unknown error'}`;

    modelInitializationStatus.value = 'error';
    isModelDownloading.value = false;

    const errorMessage = error?.message || '未知错误';
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
  // 初始化主题
  await initTheme();
  await loadPortPreference();
  await loadProxySettings();
  await loadBackgroundOperations();
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
  min-height: 100%;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.34), rgba(248, 246, 251, 0.14)),
    url('/backgrounds/catgirl-premium-portrait.webp') center / cover;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
  margin-right: 16px;
  border-radius: 50%;
  box-shadow: 0 4px 14px rgba(72, 57, 78, 0.16);
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
  flex-grow: 1;
  padding: 8px 24px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.content::-webkit-scrollbar {
  display: none;
}
.status-card {
  background: white;
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
  background: white;
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
  background: white;
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
  background: rgba(255, 255, 255, 0.52);
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
  background: white;
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
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.42), rgba(246, 243, 250, 0.2)),
    url('/backgrounds/catgirl-premium-portrait.webp') center / cover;
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

.cookie-dialog {
  width: min(100%, 520px);
  height: auto;
  max-height: calc(100% - 32px);
  overflow: hidden;
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
  background: rgba(248, 250, 252, 0.72);
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
  background: rgba(255, 255, 255, 0.66);
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

/* 快捷工具icon按钮样式 */
.rr-icon-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-start;
  padding: 16px;
  background: rgba(255, 255, 255, 0.48);
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

/* 编辑按钮 - 蓝色 */
.rr-icon-btn-edit {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.rr-icon-btn-edit:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.2);
  color: #1d4ed8;
}

/* 标注按钮 - 绿色 */
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

/* 首页视图 */
.home-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 管理入口卡片样式 */
.entry-card {
  background: rgba(255, 255, 255, 0.52);
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
</style>
