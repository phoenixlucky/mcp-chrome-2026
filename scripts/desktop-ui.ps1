param(
  [int]$Port = 12306,
  [string]$Version = '2.4.11',
  [string]$ExtensionId = 'djclnaepokchbblcnepfempfdhejjdml',
  [string]$HostName = 'com.chromemcp.nativehost',
  [string]$LogPath = '',
  [string]$IconPath = ''
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:allowExit = $false
$script:valueLabels = @{}
$script:lastError = ''

function Get-BridgeUrl([string]$path) {
  return "http://127.0.0.1:$Port$path"
}

function Invoke-BridgeRequest([string]$path, [string]$method = 'GET') {
  $request = $null
  $response = $null
  $reader = $null
  try {
    $request = [System.Net.HttpWebRequest]::Create((Get-BridgeUrl $path))
    $request.Method = $method
    $request.Timeout = 2500
    $request.ReadWriteTimeout = 2500
    $request.KeepAlive = $false
    if ($method -eq 'POST') { $request.ContentLength = 0 }
    $response = $request.GetResponse()
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $body = $reader.ReadToEnd()
    $json = $null
    if ($body) {
      try { $json = $body | ConvertFrom-Json } catch { }
    }
    return @{ Ok = $true; Status = [int]$response.StatusCode; Body = $body; Json = $json }
  } catch [System.Net.WebException] {
    $status = 0
    $body = ''
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $errorReader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $errorReader.ReadToEnd()
        $errorReader.Dispose()
      } catch { }
    }
    return @{ Ok = $false; Status = $status; Body = $body; Json = $null; Error = $_.Exception.Message }
  } catch {
    return @{ Ok = $false; Status = 0; Body = ''; Json = $null; Error = $_.Exception.Message }
  } finally {
    if ($reader) { $reader.Dispose() }
    if ($response) { $response.Dispose() }
  }
}

function Set-Value([string]$name, [string]$value, [System.Drawing.Color]$color = [System.Drawing.Color]::FromArgb(60, 60, 60)) {
  if ($script:valueLabels.ContainsKey($name)) {
    $script:valueLabels[$name].Text = $value
    $script:valueLabels[$name].ForeColor = $color
  }
}

function Add-StatusRow([string]$name, [int]$y) {
  $caption = New-Object System.Windows.Forms.Label
  $caption.Text = $name
  $caption.Location = New-Object System.Drawing.Point(24, $y)
  $caption.Size = New-Object System.Drawing.Size(138, 24)
  $caption.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 100)
  $form.Controls.Add($caption)

  $value = New-Object System.Windows.Forms.Label
  $value.Text = '检查中...'
  $value.Location = New-Object System.Drawing.Point(164, $y)
  $value.Size = New-Object System.Drawing.Size(450, 24)
  $value.AutoEllipsis = $true
  $form.Controls.Add($value)
  $script:valueLabels[$name] = $value
}

function Set-DisconnectedState([string]$message) {
  Set-Value '服务状态' '未启动 / 等待 Chrome 插件' ([System.Drawing.Color]::FromArgb(180, 110, 20))
  Set-Value 'Chrome 扩展' '未连接' ([System.Drawing.Color]::FromArgb(180, 70, 60))
  Set-Value 'Native Host' '未连接' ([System.Drawing.Color]::FromArgb(180, 70, 60))
  Set-Value '健康检查' '未检查' ([System.Drawing.Color]::FromArgb(100, 100, 100))
  Set-Value '端口' "$Port"
  Set-Value 'MCP 会话' '-'
  Set-Value '工具数量' '-'
  $details.Text = $message
}

function Update-Status([bool]$probe = $false) {
  $path = if ($probe) { '/status?probe=1' } else { '/status' }
  $result = Invoke-BridgeRequest $path
  if (-not $result.Ok -or -not $result.Json) {
    $errorText = if ($result.Error) { $result.Error } else { "HTTP $($result.Status)" }
    Set-DisconnectedState "服务尚未监听 $Port。请确认 Chrome 已加载此版本扩展；扩展连接后服务会自动启动。`r`n$errorText"
    return
  }

  $data = $result.Json
  $serverRunning = [bool]$data.server.serviceRunning
  $extensionConnected = [bool]$data.extension.connected
  $nativeConnected = [bool]$data.nativeHost.connected
  $serverText = if ($serverRunning -and $nativeConnected) { '运行中' } elseif ($serverRunning) { '运行中（等待 Chrome）' } else { '已停止' }
  $serverColor = if ($serverRunning -and $nativeConnected) { [System.Drawing.Color]::FromArgb(25, 130, 70) } else { [System.Drawing.Color]::FromArgb(180, 110, 20) }
  $extensionText = if ($extensionConnected) { '已连接' } else { '未连接' }
  $extensionColor = if ($extensionConnected) { [System.Drawing.Color]::FromArgb(25, 130, 70) } else { [System.Drawing.Color]::FromArgb(180, 70, 60) }
  $nativeText = if ($nativeConnected) { '已连接' } else { '等待连接' }
  $nativeColor = if ($nativeConnected) { [System.Drawing.Color]::FromArgb(25, 130, 70) } else { [System.Drawing.Color]::FromArgb(180, 110, 20) }
  Set-Value '服务状态' $serverText $serverColor
  Set-Value 'Chrome 扩展' $extensionText $extensionColor
  Set-Value 'Native Host' $nativeText $nativeColor
  Set-Value '端口' "$Port"
  Set-Value 'MCP 会话' ([string]$data.mcp.activeSessions)
  Set-Value '工具数量' ([string]$data.tools.count)

  if ($probe) {
    if ($data.probe.ok) {
      Set-Value '健康检查' "正常（$($data.probe.elapsedMs) ms）" ([System.Drawing.Color]::FromArgb(25, 130, 70))
    } else {
      Set-Value '健康检查' '失败：Chrome 没有返回' ([System.Drawing.Color]::FromArgb(180, 70, 60))
    }
  } elseif ($serverRunning -and -not $nativeConnected) {
    Set-Value '健康检查' '无法检查（Chrome 未连接）' ([System.Drawing.Color]::FromArgb(180, 70, 60))
  } elseif ($serverRunning) {
    Set-Value '健康检查' '未检查（点击“健康检查”）' ([System.Drawing.Color]::FromArgb(100, 100, 100))
  } else {
    Set-Value '健康检查' '服务已停止' ([System.Drawing.Color]::FromArgb(180, 110, 20))
  }

  $activity = $data.nativeHost.lastActivityAt
  $details.Text = "服务地址：http://127.0.0.1:$Port/mcp`r`n扩展 ID：$ExtensionId`r`nNative Messaging：$HostName`r`n最后活动：$(if ($activity) { $activity } else { '暂无' })"
  $script:lastError = ''
}

function Invoke-Control([string]$path) {
  $result = Invoke-BridgeRequest $path 'POST'
  if ($result.Ok) {
    Update-Status $false
    return $true
  }
  $message = if ($result.Body) { $result.Body } elseif ($result.Error) { $result.Error } else { "HTTP $($result.Status)" }
  $script:lastError = $message
  $details.Text = "操作失败：$message"
  return $false
}

function Show-BridgeForm {
  $form.Show()
  $form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  $form.Activate()
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Chrome MCP Bridge $Version"
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(650, 535)
$form.MinimumSize = New-Object System.Drawing.Size(650, 535)
$form.MaximumSize = New-Object System.Drawing.Size(650, 535)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.ShowInTaskbar = $true
$form.BackColor = [System.Drawing.Color]::White

$title = New-Object System.Windows.Forms.Label
$title.Text = "Chrome MCP Bridge $Version"
$title.Location = New-Object System.Drawing.Point(24, 16)
$title.Size = New-Object System.Drawing.Size(590, 32)
$title.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = '常驻服务管理器 · 关闭窗口会最小化到系统托盘'
$subtitle.Location = New-Object System.Drawing.Point(26, 50)
$subtitle.Size = New-Object System.Drawing.Size(590, 24)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 100)
$form.Controls.Add($subtitle)

Add-StatusRow '服务状态' 92
Add-StatusRow 'Chrome 扩展' 122
Add-StatusRow 'Native Host' 152
Add-StatusRow '健康检查' 182
Add-StatusRow '端口' 212
Add-StatusRow 'MCP 会话' 242
Add-StatusRow '工具数量' 272

$refreshButton = New-Object System.Windows.Forms.Button
$refreshButton.Text = '刷新状态'
$refreshButton.Location = New-Object System.Drawing.Point(24, 315)
$refreshButton.Size = New-Object System.Drawing.Size(100, 32)
$refreshButton.Add_Click({ Update-Status $false })
$form.Controls.Add($refreshButton)

$healthButton = New-Object System.Windows.Forms.Button
$healthButton.Text = '健康检查'
$healthButton.Location = New-Object System.Drawing.Point(132, 315)
$healthButton.Size = New-Object System.Drawing.Size(100, 32)
$healthButton.Add_Click({ Update-Status $true })
$form.Controls.Add($healthButton)

$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = '启动服务'
$startButton.Location = New-Object System.Drawing.Point(240, 315)
$startButton.Size = New-Object System.Drawing.Size(100, 32)
$startButton.Add_Click({ Invoke-Control '/__chrome_mcp_bridge/start' | Out-Null })
$form.Controls.Add($startButton)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = '停止服务'
$stopButton.Location = New-Object System.Drawing.Point(348, 315)
$stopButton.Size = New-Object System.Drawing.Size(100, 32)
$stopButton.Add_Click({ Invoke-Control '/__chrome_mcp_bridge/stop' | Out-Null })
$form.Controls.Add($stopButton)

$logButton = New-Object System.Windows.Forms.Button
$logButton.Text = '打开日志'
$logButton.Location = New-Object System.Drawing.Point(456, 315)
$logButton.Size = New-Object System.Drawing.Size(100, 32)
$logButton.Add_Click({
  if (-not (Test-Path $LogPath)) { New-Item -ItemType File -Path $LogPath -Force | Out-Null }
  Start-Process notepad.exe -ArgumentList $LogPath
})
$form.Controls.Add($logButton)

$details = New-Object System.Windows.Forms.TextBox
$details.Location = New-Object System.Drawing.Point(24, 365)
$details.Size = New-Object System.Drawing.Size(590, 105)
$details.Multiline = $true
$details.ReadOnly = $true
$details.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
$details.BackColor = [System.Drawing.Color]::FromArgb(248, 248, 248)
$details.Font = New-Object System.Drawing.Font('Consolas', 9)
$form.Controls.Add($details)

$hint = New-Object System.Windows.Forms.Label
$hint.Text = 'MCP 地址：http://127.0.0.1:' + $Port + '/mcp    ·    扩展 ID：' + $ExtensionId
$hint.Location = New-Object System.Drawing.Point(24, 485)
$hint.Size = New-Object System.Drawing.Size(590, 24)
$hint.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 100)
$form.Controls.Add($hint)

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$trayIcon = $null
if ($IconPath -and (Test-Path -LiteralPath $IconPath)) {
  try { $trayIcon = New-Object System.Drawing.Icon -ArgumentList $IconPath } catch { $trayIcon = $null }
}
if ($trayIcon) {
  $form.Icon = $trayIcon
  $notifyIcon.Icon = $trayIcon
} else {
  $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}
$notifyIcon.Text = "Chrome MCP Bridge $Version"
$notifyIcon.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$showItem = $menu.Items.Add('显示客户端')
$showItem.Add_Click({ Show-BridgeForm })
$checkItem = $menu.Items.Add('立即健康检查')
$checkItem.Add_Click({ Show-BridgeForm; Update-Status $true })
$menu.Items.Add('-') | Out-Null
$exitItem = $menu.Items.Add('退出客户端（停止服务）')
$exitItem.Add_Click({
  Invoke-Control '/__chrome_mcp_bridge/stop' | Out-Null
  $script:allowExit = $true
  $notifyIcon.Visible = $false
  $refreshTimer.Stop()
  $form.Close()
})
$notifyIcon.ContextMenuStrip = $menu
$notifyIcon.Add_DoubleClick({ Show-BridgeForm })

$form.Add_FormClosing({
  param($sender, $eventArgs)
  if (-not $script:allowExit) {
    $eventArgs.Cancel = $true
    $form.Hide()
    $notifyIcon.ShowBalloonTip(1500, 'Chrome MCP Bridge', '客户端仍在后台运行，可从系统托盘打开。', [System.Windows.Forms.ToolTipIcon]::Info)
  }
})
$form.Add_SizeChanged({
  if ($form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    $form.Hide()
  }
})

Update-Status $false
$refreshTimer = New-Object System.Windows.Forms.Timer
$refreshTimer.Interval = 3000
$refreshTimer.Add_Tick({ Update-Status $false })
$refreshTimer.Start()

# If a Native Host is already connected but its service was paused, resume it.
$startupTimer = New-Object System.Windows.Forms.Timer
$startupTimer.Interval = 600
$startupTimer.Add_Tick({
  $startupTimer.Stop()
  Invoke-Control '/__chrome_mcp_bridge/start' | Out-Null
})
$startupTimer.Start()

$form.Add_Shown({ $form.Activate() })
# Explicitly show the form because the parent EXE starts PowerShell with a
# hidden console; relying only on Application.Run can inherit that state.
$form.Show()
$form.BringToFront()
$form.Activate()
[System.Windows.Forms.Application]::Run($form)

$refreshTimer.Stop()
$startupTimer.Stop()
$notifyIcon.Visible = $false
$notifyIcon.Dispose()
if ($trayIcon) { $trayIcon.Dispose() }
$menu.Dispose()
