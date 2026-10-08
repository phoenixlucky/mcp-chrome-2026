# Issues Overview

## 📊 Stats

- **Total issues**: 183
- **Open**: 116
- **Closed**: 67
- **Close rate**: 36.6%
- **Last updated**: 2025-10-11

## 📑 Contents

- [Feature requests](#feature-requests)
- [Bug reports](#bug-reports)
- [Installation issues](#installation-issues)
- [Configuration issues](#configuration-issues)
- [Compatibility issues](#compatibility-issues)
- [Documentation improvements](#documentation-improvements)
- [Resolved issues](#resolved-issues)

---

## 🚀 Feature requests

### Open

#### #215 chrome_console returns incomplete data

- **Status**: OPEN
- **Author**: africa1207
- **Date**: 2025-09-30
- **Description**: chrome_console data is a shallow copy; deep object info can't be retrieved

#### #207 Screenshots can't autosave? I have to manually click Save?

- **Status**: OPEN
- **Author**: FVEFWFE
- **Date**: 2025-09-18
- **Description**: Hope screenshots can be saved automatically without manually clicking save

#### #205 Support getting info from clipboard into page inputs

- **Status**: OPEN
- **Author**: sunzh231
- **Date**: 2025-09-17
- **Description**: Get info from the clipboard directly based on the input box under the mouse cursor, avoiding Inject Script being blocked by the browser CSP

#### #202 How to use this plugin in an Electron app

- **Status**: OPEN
- **Author**: lyl340321
- **Date**: 2025-09-13
- **Description**: Added a simple browser feature in Electron and want to reuse this plugin to provide an mcp service

#### #201 chrome-mcp can't get info from dialogs

- **Status**: OPEN
- **Author**: qphien
- **Date**: 2025-09-12
- **Description**: The dialog contains token-sensitive info, but the value obtained by reading it via js is empty

#### #200 How to scroll the page

- **Status**: OPEN
- **Author**: qphien
- **Date**: 2025-09-12
- **Description**: How to instruct chrome-mcp to scroll the page on Mac; calling the space hotkey doesn't scroll the Chrome page

#### #190 No offline loading of local models?

- **Status**: OPEN
- **Author**: long36708
- **Date**: 2025-09-02
- **Description**: In an intranet environment, models on hugeface can't be downloaded automatically because the network is unreachable

#### #183 how to save the HTML displayed in the Chrome browser using Chrome MCP

- **Status**: OPEN
- **Author**: sansanai
- **Date**: 2025-08-28
- **Description**: How to save the HTML content displayed in the Chrome browser, especially when it's very large

#### #180 Service status randomly stops

- **Status**: OPEN
- **Author**: IAmKongHai
- **Date**: 2025-08-28
- **Description**: Hope for better stability, keeping the service running until the browser exits

#### #178 Page pops up automatically after MCP opens Chrome

- **Status**: OPEN
- **Author**: MiloQ
- **Date**: 2025-08-27
- **Description**: Hope the browser can run silently in the background

#### #177 n8n integration

- **Status**: OPEN
- **Author**: judaemon
- **Date**: 2025-08-27
- **Description**: Is it usable in an n8n workflow

#### #175 Can the mcp server be started in sse mode

- **Status**: OPEN
- **Author**: FriSeaSky
- **Date**: 2025-08-25
- **Description**: The readme only lists the other two modes; hope sse mode can be implemented

#### #171 Tab group api controls

- **Status**: OPEN
- **Author**: danieliser
- **Date**: 2025-08-21
- **Description**: Let MCP control tab groups: create, delete, add tabs to groups, etc.

#### #169 Feature Request: Support Environment Variables to Disable Specific Tools

- **Status**: OPEN
- **Author**: lathidadia
- **Date**: 2025-08-20
- **Description**: Support disabling or filtering specific tools via environment variables to solve tool name conflicts

#### #162 Needs some rate limit logic from tools going rogue in the real browser

- **Status**: OPEN
- **Author**: neberej
- **Date**: 2025-08-16
- **Description**: Need to add rate limiting logic to keep tools from going rogue

#### #157 Chrome Web Store

- **Status**: OPEN
- **Author**: nelzomal
- **Date**: 2025-08-13
- **Description**: Any plans to publish to the Chrome web store

#### #155 More intelligent

- **Status**: OPEN
- **Author**: nullCode666
- **Date**: 2025-08-13
- **Description**: Hope MCP can automatically understand the current page's source code and find the corresponding encryption methods

#### #153 `chrome_inject_script` not working on some sites

- **Status**: OPEN
- **Author**: rmorse
- **Date**: 2025-08-12
- **Description**: chrome_inject_script doesn't work on some sites; different injection points need support

#### #141 Support mouse hover and multi-window mcp isolation

- **Status**: OPEN
- **Author**: lironghai
- **Date**: 2025-08-07
- **Description**: Support mouse hover and multi-window MCP isolation

### Closed

#### #145 Add file upload capability for web forms

- **Status**: CLOSED
- **Author**: kaovilai
- **Date**: 2025-08-08
- **Description**: Add file upload support for web forms

#### #107 Support .dxt format

- **Status**: CLOSED
- **Author**: metalshanked
- **Date**: 2025-07-16
- **Description**: Support the .dxt format released by Anthropic for one-click install

---

## 🐛 Bug reports

### Open

#### #215 chrome_console returns incomplete data

- **Status**: OPEN
- **Author**: africa1207
- **Date**: 2025-09-30
- **Description**: chrome_console data is a shallow copy; deep objects show as "object"

#### #212 Tool call error

- **Status**: OPEN
- **Author**: zhaooa
- **Date**: 2025-09-28
- **Description**: The tool is enabled, but it still says tool call error

#### #209 Graphic draws nothing in the first example though the mcp tool was called

- **Status**: OPEN
- **Author**: scwlkq
- **Date**: 2025-09-26

#### #206 Request error

- **Status**: OPEN
- **Author**: lghxuelang
- **Date**: 2025-09-18
- **Description**: Invalid or missing MCP session ID for SSE

#### #204 Frequently opens chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/true

- **Status**: OPEN
- **Author**: Wouldyouplace45
- **Date**: 2025-09-15
- **Description**: The browser shows it can't access your file

#### #191 chrome_console requires that dev tools are closed on the current page

- **Status**: OPEN
- **Author**: string1225
- **Date**: 2025-09-03
- **Description**: This is a Chrome browser mechanism limitation

#### #184 trae shows some tool names exceeding the 60-character limit

- **Status**: OPEN
- **Author**: wangqi996
- **Date**: 2025-08-29

#### #163 chrome_screenshot always gives "exceeds maximum allowed tokens" error

- **Status**: OPEN
- **Author**: maddada
- **Date**: 2025-08-18
- **Description**: Screenshot response exceeds the max allowed token count (25000)

#### #152 Chaos during concurrent execution

- **Status**: OPEN
- **Author**: shatang123
- **Date**: 2025-08-12
- **Description**: tabId mismatches and tabs not closing when scraping pages concurrently

#### #149 Constant script injection failures

- **Status**: OPEN
- **Author**: manzhonglu
- **Date**: 2025-08-11

#### #144 It opens the page and then waits until it times out

- **Status**: OPEN
- **Author**: shopkeeper2020
- **Date**: 2025-08-08

#### #142 I opened a page and it can't even click something for me

- **Status**: OPEN
- **Author**: bbhxwl
- **Date**: 2025-08-07
- **Description**: Using qweb3 4b; it only answers questions and doesn't perform clicks

#### #139 Error: Error calling tool: Request timed out after 30000ms

- **Status**: OPEN
- **Author**: sunhao28256
- **Date**: 2025-08-05

#### #136 `chrome_keyboard` is not working with Claude Code

- **Status**: OPEN
- **Author**: hanayashiki
- **Date**: 2025-08-03
- **Description**: It shows success but nothing is typed into the textarea

#### #128 It keeps retrying when a page element can't be found

- **Status**: OPEN
- **Author**: GragonForce666
- **Date**: 2025-07-29

#### #122 All kinds of timeouts, stops automatically

- **Status**: OPEN
- **Author**: fordiy
- **Date**: 2025-07-26
- **Description**: Already increased the 30s timeout 10x, still timing out

#### #118 Can't auto-click the cloudflare human verification

- **Status**: OPEN
- **Author**: windzhu0514
- **Date**: 2025-07-23

#### #114 Douban and Jike don't seem scrapeable

- **Status**: OPEN
- **Author**: imHw
- **Date**: 2025-07-20
- **Description**: AI reports problems accessing these sites, possibly anti-scraping mechanisms

#### #112 chrome_network_debugger's maxRequests is too low

- **Status**: OPEN
- **Author**: kanekanefy
- **Date**: 2025-07-19
- **Description**: maxRequests stops automatically after 100 requests

#### #111 Error when taking website screenshots with CherryStudio

- **Status**: OPEN
- **Author**: GehuaZhang
- **Date**: 2025-07-18
- **Description**: Cannot read properties of undefined (reading 'map')

#### #99 chrome_get_web_content seems to return incomplete page info

- **Status**: OPEN
- **Author**: Reviel
- **Date**: 2025-07-13
- **Description**: The Description section content is missing when fetching a PostGIS ticket page

#### #92 AI can't close alert dialogs

- **Status**: OPEN
- **Author**: chgblog
- **Date**: 2025-07-11
- **Description**: After an alert or confirm dialog appears, the AI can't continue and shows an MCP timeout

#### #67 windows function call reports a timeout error

- **Status**: OPEN
- **Author**: zhiyu
- **Date**: 2025-07-01

### Closed

#### #181 The extension stays disconnected

- **Status**: CLOSED
- **Author**: Arefinw
- **Date**: 2025-08-28

#### #140 Voice engine initialization failed

- **Status**: CLOSED
- **Author**: Demi555
- **Date**: 2025-08-06

#### #116 Plugin disconnects automatically after clicking connect, losing focus, or hiding

- **Status**: CLOSED
- **Author**: BeginnerDone
- **Date**: 2025-07-22

#### #73 API Error: 413: Prompt is too long

- **Status**: CLOSED
- **Author**: Lehtien
- **Date**: 2025-07-04

#### #60 Claude code Chrome MCP server startup prints console.log lines containing emoji

- **Status**: CLOSED
- **Author**: gabyic
- **Date**: 2025-06-28
- **Description**: Causes MCP protocol JSON parsing errors

---

## 📦 Installation issues

### Open

#### #198 About the plugin failing to connect in Chrome

- **Status**: OPEN
- **Author**: nice-nicegod
- **Date**: 2025-09-09
- **Description**: The plugin shows "Connected, Service Not Started". This happens if the default Node.js install path is changed

#### #187 Shows Connected, Service Not Started when opening the connection

- **Status**: OPEN
- **Author**: wyx66624
- **Date**: 2025-08-31
- **Description**: mcp-chrome-bridge was registered manually, but no process is listening on port 12306

#### #174 Browser in Docker + Chrome MCP: troubleshooting

- **Status**: OPEN
- **Author**: f3l1x
- **Date**: 2025-08-25
- **Description**: Pre-installed the extension in a Docker virtual browser and it shows "Connected, Service Not Started"

#### #170 Claude Code integration on WSL

- **Status**: OPEN
- **Author**: TimHuey
- **Date**: 2025-08-20
- **Description**: Claude Code in WSL can't recognize the mcp server

#### #159 WSL Support?

- **Status**: OPEN
- **Author**: D3OXY
- **Date**: 2025-08-14

#### #148 Extension started successfully, but the command line shows failed

- **Status**: OPEN
- **Author**: joytianya
- **Date**: 2025-08-10

#### #147 Any plans to support docker deployment

- **Status**: OPEN
- **Author**: tgscan-dev
- **Date**: 2025-08-10

#### #143 How to deploy this mcp service on a server

- **Status**: OPEN
- **Author**: no-bystander
- **Date**: 2025-08-08

#### #138 Plugin installed in Chrome, port configurable

- **Status**: OPEN
- **Author**: KylanJimmy
- **Date**: 2025-08-05
- **Description**: Can the port bind to 0.0.0.0 instead of just 127.0.0.1

#### #137 Connected, Service Not Started on win

- **Status**: OPEN
- **Author**: steven111920
- **Date**: 2025-08-04
- **Description**: Clicking run_host.bat shows access denied

#### #127 Connected, Service Not Started

- **Status**: OPEN
- **Author**: Fanzaijun
- **Date**: 2025-07-29

#### #115 Connected, Service Not Started

- **Status**: OPEN
- **Author**: yanghao112
- **Date**: 2025-07-21
- **Description**: Tried every troubleshooting step, still doesn't work

#### #106 Starts successfully but can't be configured

- **Status**: OPEN
- **Author**: crxxxxxxx
- **Date**: 2025-07-15

#### #90 Can't start

- **Status**: OPEN
- **Author**: qiffang
- **Date**: 2025-07-11
- **Description**: Running run_hosts.sh just hangs

#### #88 Failed to install on Apple Silicon Mac

- **Status**: OPEN
- **Author**: DaniloHandsOn
- **Date**: 2025-07-10
- **Description**: chrome-mcp-bridge command not found

#### #85 Constant Session termination 400 errors

- **Status**: OPEN
- **Author**: hcoona
- **Date**: 2025-07-08

#### #78 docs/CONTRIBUTING.md instructions to build missing packages/shared build

- **Status**: OPEN
- **Author**: adrianlzt
- **Date**: 2025-07-06
- **Description**: Docs are missing the shared package build step

#### #68 Execute mcp-chrome-bridge -v and report [ERR_REQUIRE_ESM]

- **Status**: OPEN
- **Author**: coisini6
- **Date**: 2025-07-02
- **Description**: ERR_REQUIRE_ESM error on Windows 10

#### #65 Browser plugin service not connected on mac m4

- **Status**: OPEN
- **Author**: wzp-coding
- **Date**: 2025-06-30
- **Description**: Followed troubleshooting; running index.js hangs with no response

#### #62 Can't start

- **Status**: OPEN
- **Author**: Mocha-s
- **Date**: 2025-06-28
- **Description**: Just don't know how to start it

### Closed

#### #196 SOLUTION - Native Messaging not working in Chromium

- **Status**: CLOSED (fixed by PR #195)
- **Author**: gebeer
- **Date**: 2025-09-07
- **Description**: The mcp-chrome-bridge npm package only installs to the Chrome directory and doesn't support Chromium

#### #161 unexpected error: Running Status --> "Connected, Service Not Started"

- **Status**: CLOSED
- **Author**: TonnyWong1052
- **Date**: 2025-08-15

#### #154 Chrome failed to load the extension

- **Status**: CLOSED
- **Author**: mmhzlrj
- **Date**: 2025-08-12
- **Description**: Missing 'manifest_version' key

#### #81 Directory problem when chromium fails to launch

- **Status**: CLOSED
- **Author**: lesszzen
- **Date**: 2025-07-07
- **Description**: Chromium's config directory is .config/chromium on Linux

#### #69 Any plans to support firefox

- **Status**: CLOSED
- **Author**: Shuai-S
- **Date**: 2025-07-02

#### #64 Linux deployment isn't supported, right

- **Status**: CLOSED
- **Author**: caiji2019-cai
- **Date**: 2025-06-30

#### #22 Fails on Mac, Native service didn't start

- **Status**: CLOSED
- **Author**: DengKaiRong
- **Date**: 2025-06-19

#### #16 Started the project in dev mode, server didn't start

- **Status**: CLOSED
- **Author**: WSCZou
- **Date**: 2025-06-18

---

## ⚙️ Configuration issues

### Open

#### #203 INSTALL IN THE CURSOR, LOADING TOOLS,BUT NOT SUCESS

- **Status**: OPEN
- **Author**: chenhunhun
- **Date**: 2025-09-14
- **Description**: Tool loading fails after configuring in Cursor

#### #199 Claude code cli can't connect, what's wrong

- **Status**: OPEN
- **Author**: 666xjs
- **Date**: 2025-09-10
- **Description**: The server runs successfully, but it just can't connect

#### #188 Can't connect in windsurf

- **Status**: OPEN
- **Author**: NoComments
- **Date**: 2025-09-02
- **Description**: Error: TransformStream is not defined

#### #185 Kiro says "Enabled MCP Server chrome-mcp-server must specify a command"

- **Status**: OPEN
- **Author**: Chris-C1108
- **Date**: 2025-08-29
- **Description**: Not sure what command refers to; maybe kiro doesn't support the streamable-http type

#### #182 Claude CLI fails to connect to running server on macOS

- **Status**: OPEN
- **Author**: dreamreels
- **Date**: 2025-08-28
- **Description**: The extension shows running fine, but the claude CLI can't connect

#### #173 claude code doesn't support streamableHttp

- **Status**: OPEN
- **Author**: Baddts
- **Date**: 2025-08-24
- **Description**: claude code doesn't load this mcp after configuring streamableHttp

#### #168 Failed to parse MCP servers from JSON

- **Status**: OPEN
- **Author**: joyhu
- **Date**: 2025-08-19

#### #167 claude code mcp can't connect

- **Status**: OPEN
- **Author**: TheBloodthirster
- **Date**: 2025-08-18
- **Description**: Native connection disconnected

#### #160 Error when using multilingual-e5-base

- **Status**: OPEN
- **Author**: lcylcyll
- **Date**: 2025-08-15
- **Description**: The model requires 768D dimensions, but it errors in Chrome

#### #150 Readme Image not found - Installation- Step 3

- **Status**: OPEN
- **Author**: amritbanerjee
- **Date**: 2025-08-12
- **Description**: The image link in step 3 of the Readme file is a 404

#### #135 Which library is the callTool() tool function in

- **Status**: OPEN
- **Author**: hechengdu
- **Date**: 2025-08-03

#### #134 Cursor can't connect to Chrome MCP

- **Status**: OPEN
- **Author**: shengcruz
- **Date**: 2025-08-02
- **Description**: Shows "No connection to browser extension"

#### #132 trae fails to load

- **Status**: OPEN
- **Author**: mimicode
- **Date**: 2025-08-02
- **Description**: chrome_send_command_to_inject_script exceeds 60 characters

#### #131 claude desktop doesn't recognize it after configuration

- **Status**: OPEN
- **Author**: microxxx
- **Date**: 2025-08-01

#### #124 See the screenshot, it says drawing is done, but Excalidraw stays blank

- **Status**: OPEN
- **Author**: fordiy
- **Date**: 2025-07-27

#### #123 It often stops automatically while the AI is outputting

- **Status**: OPEN
- **Author**: fordiy
- **Date**: 2025-07-26
- **Description**: Can't continue drawing in excalidraw on the original page

#### #121 Can't call it after cherrystudio upgraded to 1.5.3

- **Status**: OPEN
- **Author**: csfeng1
- **Date**: 2025-07-26

#### #109 cherrystudio can't use MCP properly

- **Status**: OPEN
- **Author**: kksqwerc
- **Date**: 2025-07-17
- **Description**: Tools are listed, but can't be called accurately during conversation

#### #103 A 400 error usually means the client config is wrong

- **Status**: OPEN
- **Author**: ifastcc
- **Date**: 2025-07-15
- **Description**: Provides the correct configuration for Claude code, Gemini cli, and Cursor

#### #102 Cherry-Studio fails to start

- **Status**: OPEN
- **Author**: Bboossccoo
- **Date**: 2025-07-14

#### #100 cursor reports Error calling tool when calling excalidraw

- **Status**: OPEN
- **Author**: DevilMay-Cry
- **Date**: 2025-07-14
- **Description**: Request timed out after 30000ms

#### #101 vscode use: type to open url, type credentials, stuck on opening url

- **Status**: OPEN
- **Author**: kkk123dm
- **Date**: 2025-07-14

### Closed

#### #221 How to configure mcp-chrome in VSC?

- **Status**: CLOSED
- **Author**: valuex
- **Date**: 2025-10-04
- **Description**: Can't start the server after configuration

#### #193 Cursor keeps showing loading tools after adding mcp

- **Status**: CLOSED
- **Author**: lixiaolong613
- **Date**: 2025-09-04

#### #192 Access connection reset after deploying to a remote server

- **Status**: CLOSED
- **Author**: wlxwlxwlx
- **Date**: 2025-09-04

#### #164 How to use predefined prompt templates in claude desktop too

- **Status**: CLOSED
- **Author**: WeiyangZhang
- **Date**: 2025-08-18

#### #133 issue with setting up the MCP in Claude Code

- **Status**: CLOSED
- **Author**: seldaneg
- **Date**: 2025-08-02

#### #113 Error invoking remote method 'mcp:restart-server'

- **Status**: CLOSED
- **Author**: Daiyuxin26
- **Date**: 2025-07-19

#### #102 Cherry-Studio fails to start

- **Status**: CLOSED
- **Author**: Bboossccoo
- **Date**: 2025-07-14

#### #57 DIFY MCP call failed

- **Status**: CLOSED
- **Author**: SpringMeta
- **Date**: 2025-06-27

#### #45 Error connecting MCP under Cherry Studio

- **Status**: CLOSED
- **Author**: nooldey
- **Date**: 2025-06-25
- **Description**: serverType is wrong; camelCase should be used

#### #32 Fails to start in vscode

- **Status**: CLOSED
- **Author**: linjinxing
- **Date**: 2025-06-23

#### #30 Can't use it

- **Status**: CLOSED
- **Author**: 2513483494
- **Date**: 2025-06-23
- **Description**: unexpected status code: 400

#### #19 Errors appear after configuring in cursor

- **Status**: CLOSED
- **Author**: Sumouren1
- **Date**: 2025-06-18

#### #18 No cursor/cline support?

- **Status**: CLOSED
- **Author**: Rainmen-xia
- **Date**: 2025-06-18

#### #13 cherry studio addition failed

- **Status**: CLOSED
- **Author**: LLmoskk
- **Date**: 2025-06-17

#### #8 chrome_navigate call error

- **Status**: CLOSED
- **Author**: fcyf
- **Date**: 2025-06-16

---

## 🔌 Compatibility issues

### Open

#### #172 iframe page elements not found

- **Status**: OPEN
- **Author**: Actor12
- **Date**: 2025-08-22
- **Description**: chrome_fill_or_selector always returns not found on pages built with iframe

#### #126 Auto-reply, auto-publish — want stronger features

- **Status**: OPEN
- **Author**: smartchainark
- **Date**: 2025-07-29
- **Description**: Can't complete tasks properly on the X platform and Xiaohongshu platform

#### #93 How to get dynamic data

- **Status**: OPEN
- **Author**: carter115
- **Date**: 2025-07-11
- **Description**: Data whose API is only called after scrolling the mouse on the page

#### #43 [No data output] cursor+edge test drawing a month of browsing history

- **Status**: OPEN
- **Author**: 3377
- **Date**: 2025-06-24

#### #42 Can it work together with automa to build workflows?

- **Status**: OPEN
- **Author**: 3377
- **Date**: 2025-06-24

#### #40 Semantic engine initialization failed

- **Status**: OPEN
- **Author**: HY-Hu
- **Date**: 2025-06-24

#### #39 Constant permission errors

- **Status**: OPEN
- **Author**: mozhuangshu
- **Date**: 2025-06-24

#### #33 Element not found

- **Status**: OPEN
- **Author**: 2513483494
- **Date**: 2025-06-23
- **Description**: Can't find elements on the Tencent Cloud console page

### Closed

---

## 📚 Documentation improvements

### Open

#### #197 Can't run it from a command

- **Status**: OPEN
- **Author**: lujuny328-cmyk
- **Date**: 2025-09-08
- **Description**: Putting the bridge link in the command doesn't work

#### #189 Please add me to the group

- **Status**: OPEN
- **Author**: wwenj
- **Date**: 2025-09-02
- **Description**: The group QR code in the docs has expired

#### #117 Seems there's no tool to click extension popup?

- **Status**: OPEN
- **Author**: sunweihunu
- **Date**: 2025-07-22
- **Description**: Hope for a tool to click the Chrome extension popup

#### #125 QR code expired

- **Status**: OPEN
- **Author**: NuoLanC
- **Date**: 2025-07-29

### Closed

#### #95 Organizing web docs with images is worse than playwright

- **Status**: CLOSED
- **Author**: Xuzan9396
- **Date**: 2025-07-12

#### #94 readme video link broken

- **Status**: CLOSED
- **Author**: vcan
- **Date**: 2025-07-11

#### #91 Group is full, please add me

- **Status**: CLOSED
- **Author**: huangxingzhao
- **Date**: 2025-07-11

#### #89 What is this tool

- **Status**: CLOSED
- **Author**: Messilimeng
- **Date**: 2025-07-11
- **Description**: Do you have a good interactive prompt for cursor

#### #84 How to configure my own AI?

- **Status**: CLOSED
- **Author**: liaoyu-zju
- **Date**: 2025-07-08

#### #83 WeChat QR code in the Chinese docs expired

- **Status**: CLOSED
- **Author**: YunfanGoForIt
- **Date**: 2025-07-07

#### #79 english ?

- **Status**: CLOSED
- **Author**: michabbb
- **Date**: 2025-07-06
- **Description**: The README is English while the Chrome extension is entirely Chinese

#### #75 How to reference files under the prompt directory

- **Status**: CLOSED
- **Author**: jovezhong
- **Date**: 2025-07-05

#### #52 README multimedia resource 404 issue

- **Status**: CLOSED
- **Author**: yunkst
- **Date**: 2025-06-26

#### #49 What is this LLM chat tool on the right side of the browser in the video?

- **Status**: CLOSED
- **Author**: MoeMoeFish
- **Date**: 2025-06-25

#### #48 Suggest the author create a WeChat group

- **Status**: CLOSED
- **Author**: goreycn
- **Date**: 2025-06-25

#### #44 Can't see the link button to view MCP config

- **Status**: CLOSED
- **Author**: jimleee
- **Date**: 2025-06-25

#### #35 Drawing feature isn't working

- **Status**: CLOSED
- **Author**: guangzhou
- **Date**: 2025-06-23

#### #34 How to draw on the canvas

- **Status**: CLOSED
- **Author**: guangzhou
- **Date**: 2025-06-23

#### #31 Can you add reading Console logs

- **Status**: CLOSED
- **Author**: ZoidbergPi
- **Date**: 2025-06-23

#### #26 Tutorial

- **Status**: CLOSED
- **Author**: fanhaoj
- **Date**: 2025-06-22

#### #23 How to open the chat box?

- **Status**: CLOSED
- **Author**: kokwiw
- **Date**: 2025-06-20

#### #17 Comparing 2 JD products already exceeds the token limit

- **Status**: CLOSED
- **Author**: namejee
- **Date**: 2025-06-18

#### #15 Claude Desktop

- **Status**: CLOSED
- **Author**: GoldRush520
- **Date**: 2025-06-18
- **Description**: Claude Desktop is unusable in China; any alternatives

#### #11 Any chance of adding drag and drop

- **Status**: CLOSED
- **Author**: tom63001
- **Date**: 2025-06-17

---

## ✅ Resolved issues

### Community

#### #213 Want a WeChat group to chat

- **Status**: OPEN
- **Author**: zhangchao0323
- **Date**: 2025-09-29

#### #211 Please add me to the group, I want to contribute ~

- **Status**: OPEN
- **Author**: suoaiyisheng
- **Date**: 2025-09-27

### Usage questions

#### #176 claude code can't draw

- **Status**: OPEN
- **Author**: woshihoujinxin
- **Date**: 2025-08-26
- **Description**: Opened excalidraw.com to draw, but it's not smooth

#### #166 Drawing problem

- **Status**: OPEN
- **Author**: fyture
- **Date**: 2025-08-18
- **Description**: The model says it's done, but nothing appears in excalidraw

### Python integration

#### #194 How to integrate in code without an AI agent

- **Status**: CLOSED
- **Author**: dreambe
- **Date**: 2025-09-05
- **Description**: For example python; is there demo code

#### #82 Failed to call tools directly with python code

- **Status**: CLOSED
- **Author**: YunfanGoForIt
- **Date**: 2025-07-07

#### #24 Can this plugin be called with python code?

- **Status**: CLOSED
- **Author**: liulint
- **Date**: 2025-06-20

#### #21 Can an LLM without MCP support connect to this mcp server

- **Status**: CLOSED
- **Author**: JessiePen
- **Date**: 2025-06-19

### Server deployment

#### #74 Suggestion: Enable External Access to Local Server

- **Status**: OPEN
- **Author**: ErrorGz
- **Date**: 2025-07-05
- **Description**: Suggest changing HOST to 0.0.0.0 to allow external access

#### #72 Tab chaining problem

- **Status**: CLOSED
- **Author**: fundoop
- **Date**: 2025-07-04
- **Description**: Can operations on a specific tab, tab switching, etc. be added

#### #71 Can't this mcp server be separated from the client

- **Status**: CLOSED
- **Author**: xiaodiao216
- **Date**: 2025-07-03

#### #70 [Help Wanted] What is the MCP client in the project homepage video?

- **Status**: CLOSED
- **Author**: tonyxu721
- **Date**: 2025-07-03

### Other

#### #97 What is the chat tool in the usage examples

- **Status**: CLOSED
- **Author**: sbwg
- **Date**: 2025-07-12

#### #96 Where is the entry point?

- **Status**: CLOSED
- **Author**: DavidCalls
- **Date**: 2025-07-12

#### #80 alternative way question

- **Status**: CLOSED
- **Author**: yiminhale
- **Date**: 2025-07-06
- **Description**: Can npm be used instead of pnpm

#### #51 navigate feature can't open a URL in a tab

- **Status**: CLOSED
- **Author**: adoin
- **Date**: 2025-06-26

#### #25 [Feature Request] - Can I use it with my Cursor?

- **Status**: CLOSED
- **Author**: DaleXiao
- **Date**: 2025-06-21

#### #14 How to support VSCode or trae?

- **Status**: CLOSED
- **Author**: loki-zhou
- **Date**: 2025-06-17

#### #5 Where do I set up mcp in augment, mate?

- **Status**: CLOSED
- **Author**: gally16
- **Date**: 2025-06-15

---

## 📈 Issue trends

### Frequent problem types

1. **Install/config issues** (~40%): mainly Native Messaging connection failures and the service not starting
2. **Compatibility issues** (~25%): integration problems with various clients (Cursor, Claude Code, Cherry Studio, etc.)
3. **Feature requests** (~20%): file upload, mouse hover, multi-window isolation, etc.
4. **Bug reports** (~15%): tool call errors, timeouts, element lookup failures, etc.

### Common solutions

1. **Permission issues**: use `chmod -R 755` to grant permissions on the dist directory
2. **Node.js path issues**: reinstall Node.js to the default path
3. **Config format issues**: different clients use different config formats (streamableHttp vs streamable-http)
4. **Port access**: defaults to 127.0.0.1; change to 0.0.0.0 for external access

---

## 🔗 Resources

- [Troubleshooting docs](TROUBLESHOOTING_zh.md)
- [Contributing guide](CONTRIBUTING_zh.md)
- [Tool docs](TOOLS_zh.md)
- [Windows install guide](WINDOWS_INSTALL_zh.md)

---

**Last updated**: 2025-10-11  
**Stats source**: GitHub Issues API
