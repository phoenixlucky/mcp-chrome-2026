# 🚀 Installation and Connection Troubleshooting: FAQ

## Q: How can I quickly diagnose an installation or connection problem?

**A:** Run the diagnostic tool to check the Native Messaging manifest, startup script, Node.js path, and connection status:

```bash
mcp-chrome-bridge doctor
```

If the diagnostic output identifies an issue that can be fixed automatically, run:

```bash
mcp-chrome-bridge doctor --fix
```

`doctor --fix` attempts to repair common configuration issues it detects, such as writing the current Node.js path. Afterward, reconnect the extension and run `doctor` again to confirm the issue is resolved.

## Q: How can I export a diagnostic report, and what does it contain?

**A:** Use one of these commands when opening an issue or asking for help:

```bash
# Print a Markdown report in the terminal for a GitHub issue
mcp-chrome-bridge report

# Write the report to a file
mcp-chrome-bridge report --output mcp-report.md

# Copy the report to the clipboard
mcp-chrome-bridge report --copy
```

The report summarizes environment and diagnostic information useful for troubleshooting. Usernames, paths, and tokens are redacted by default to reduce the risk of sharing sensitive information. Use `--no-redact` only when full paths are necessary and you are comfortable sharing them.

## Q: Why does the local status endpoint `/status` return 403?

**A:** `/status` is also protected by the local Origin / API key checks. When you open `http://127.0.0.1:12306/status` directly in the browser address bar, the browser usually does not send an `Origin` request header. If the server has no API key configured, that request is rejected with 403. A request with an Origin that is not allowed is also rejected with 403. A 403 means the request did not pass access validation; it does not mean the service is stopped.

You can check the status from the Chrome extension or desktop client, which sends a local request with the required headers. Or, send an allowed local Origin from the command line:

```bash
curl -H "Origin: http://127.0.0.1:1420" http://127.0.0.1:12306/status
```

By default, `http://localhost` and `http://127.0.0.1` origins are allowed. If `CHROME_MCP_ALLOWED_ORIGINS` is configured, the Origin must exactly match one of its entries. If `CHROME_MCP_API_KEY` is enabled, also send `Authorization: Bearer <key>`; an allowed Origin alone is not enough.

## Q: Why does the service fail to start even though the extension says it connected?

**A:** Common causes include a startup script without execute permission or a script that cannot find Node.js. First run `mcp-chrome-bridge doctor` and follow its findings, then check the global installation, Native Messaging manifest, script permissions, and Node.js path below. The extension reporting a connection attempt does not necessarily mean the Native Host started successfully.

## Q: How can I confirm that `mcp-chrome-bridge` is installed correctly?

**A:** Make sure the package is installed globally, then run:

```bash
mcp-chrome-bridge -V
```

If the command prints a version, the current terminal can find the installed CLI. If the command is not found, the package may not be installed globally, or the global npm executable directory may be missing from `PATH`.

<img width="612" alt="Example of checking the CLI version" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

## Q: Where is the Native Messaging manifest?

**A:** Check Chrome's Native Messaging Hosts directory for `com.chromemcp.nativehost.json`:

- Windows: `C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts`
- macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts`

The manifest's `path` field should point to the Native Host startup script, and `allowed_origins` should include the extension's origin. For example:

```json
{
  "name": "com.chromemcp.nativehost",
  "description": "Node.js Host for Browser Bridge Extension",
  "path": "/Users/xxx/Library/pnpm/global/5/.pnpm/mcp-chrome-bridge@1.0.23/node_modules/mcp-chrome-bridge/dist/run_host.sh",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/"]
}
```

Without this file, Chrome cannot locate and launch the Native Host in response to an extension request. After confirming the global installation, register the manifest with:

```bash
mcp-chrome-bridge register
```

## Q: Where should I look for logs when startup fails?

**A:** Wrapper logs are stored in a directory writable by the current user:

- macOS: `~/Library/Logs/mcp-chrome-bridge/`
- Windows: `%LOCALAPPDATA%\mcp-chrome-bridge\logs\` (for example, `C:\Users\xxx\AppData\Local\mcp-chrome-bridge\logs\`)
- Linux: `~/.local/state/mcp-chrome-bridge/logs/`

The logs can help distinguish script permission errors, a missing Node.js executable, and other startup failures. If the diagnostic tool does not identify the cause, check the latest log and include a redacted diagnostic report when opening an issue.

<img width="804" alt="Example of the log directory" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

## Q: How do I fix a startup script that does not have execute permission?

**A:** If the logs or diagnostic output say that `run_host.sh` (or `run_host.bat` on Windows) cannot be executed, run:

```bash
mcp-chrome-bridge fix-permissions
```

This command repairs the startup script's execute permission. Reconnect the extension afterward. If startup still fails, check the Node.js path and logs.

## Q: Why can't the startup script find Node.js, and how do I specify its path?

**A:** When Chrome launches the Native Host, its environment can differ from your interactive terminal. With version managers such as nvm, volta, asdf, or fnm, Node.js may only be available after the terminal's startup scripts load, so the Native Host cannot find it.

Set `CHROME_MCP_NODE_PATH` to point to the Node.js executable explicitly:

```bash
export CHROME_MCP_NODE_PATH=/path/to/your/node
```

You can also run `mcp-chrome-bridge doctor --fix` in a terminal to have the tool attempt to write the current Node.js path. Restart the service and run `mcp-chrome-bridge doctor` to confirm the path check passes.

## Q: What should I do if startup still fails after checking installation, the manifest, permissions, and Node.js?

**A:** The issue may not be one of the common configuration problems above. Check the latest wrapper log in the user log directory and run `mcp-chrome-bridge report` to create a redacted report. Include both the relevant log and report when opening an issue so the cause can be investigated further.

## Q: What should I do when a tool call times out?

**A:** A session can time out after a long-running connection. Reconnect and retry the tool call. If the same operation keeps timing out, record when it happened, what operation was running, and the relevant logs; this can help determine whether the session expired or the service or browser responded slowly.

## Q: Why do different agents or models get different results from the tools?

**A:** Agents and models can differ in how they understand a task, choose tools, and organize steps, so they may use the same tool with different results. Try another agent or model, and state the goal, page or tab scope, and expected result clearly. This reduces ambiguity and makes it easier to tell whether a difference comes from the model or a connection problem.
