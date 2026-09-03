param(
  [int]$Port = 12306,
  [string]$Version = '2.5.5',
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
$script:dotLabels = @{}
$script:infoLabels = @{}
$script:lastError = ''
$script:requestBusy = $false

$script:colors = @{
  Background = [System.Drawing.Color]::FromArgb(18, 20, 26)
  Surface = [System.Drawing.Color]::FromArgb(28, 31, 40)
  SurfaceAlt = [System.Drawing.Color]::FromArgb(35, 39, 50)
  Border = [System.Drawing.Color]::FromArgb(57, 63, 78)
  Text = [System.Drawing.Color]::FromArgb(239, 242, 247)
  Muted = [System.Drawing.Color]::FromArgb(155, 164, 180)
  Accent = [System.Drawing.Color]::FromArgb(110, 168, 255)
  Green = [System.Drawing.Color]::FromArgb(78, 205, 145)
  Yellow = [System.Drawing.Color]::FromArgb(246, 190, 75)
  Red = [System.Drawing.Color]::FromArgb(244, 107, 110)
}

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

function New-Label(
  [string]$text,
  [int]$x,
  [int]$y,
  [int]$width,
  [int]$height,
  [System.Drawing.Font]$font,
  [System.Drawing.Color]$color,
  [System.Windows.Forms.Control]$parent = $form
) {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $text
  $label.Location = New-Object System.Drawing.Point($x, $y)
  $label.Size = New-Object System.Drawing.Size($width, $height)
  $label.Font = $font
  $label.ForeColor = $color
  $label.BackColor = [System.Drawing.Color]::Transparent
  $label.AutoEllipsis = $true
  $parent.Controls.Add($label)
  return $label
}

function New-Card([int]$x, [int]$y, [int]$width, [int]$height) {
  $card = New-Object System.Windows.Forms.Panel
  $card.Location = New-Object System.Drawing.Point($x, $y)
  $card.Size = New-Object System.Drawing.Size($width, $height)
  $card.BackColor = $script:colors.Surface
  $card.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
  $form.Controls.Add($card)
  return $card
}

function Set-Value(
  [string]$name,
  [string]$value,
  [System.Drawing.Color]$color = $script:colors.Text
) {
  if ($script:valueLabels.ContainsKey($name)) {
    $script:valueLabels[$name].Text = $value
    $script:valueLabels[$name].ForeColor = $color
  }
  if ($script:dotLabels.ContainsKey($name)) {
    $script:dotLabels[$name].ForeColor = $color
  }
}

function Set-Info([string]$name, [string]$value) {
  if ($script:infoLabels.ContainsKey($name)) { $script:infoLabels[$name].Text = $value }
}

function Set-Badge([string]$text, [System.Drawing.Color]$color) {
  $statusBadge.Text = "  ●  $text  "
  $statusBadge.ForeColor = $color
  $statusBadge.BackColor = [System.Drawing.Color]::FromArgb(34, $color.R, $color.G, $color.B)
}

function Add-MetricCard([string]$name, [string]$caption, [int]$x, [int]$y, [int]$width) {
  $card = New-Card $x $y $width 90
  $accent = New-Object System.Windows.Forms.Panel
  $accent.Location = New-Object System.Drawing.Point(0, 0)
  $accent.Size = New-Object System.Drawing.Size($width, 4)
  $accent.BackColor = $script:colors.Accent
  $card.Controls.Add($accent)
  New-Label $caption 16 16 ($width - 32) 20 $fontSmall $script:colors.Muted $card | Out-Null
  $value = New-Label '检查中…' 16 38 ($width - 32) 34 $fontMetric $script:colors.Text $card
  $script:valueLabels[$name] = $value
}

function Add-ConnectionRow([string]$name, [string]$caption, [int]$y) {
  $dot = New-Label '●' 18 $y 18 22 $fontBody $script:colors.Muted $connectionsCard
  $script:dotLabels[$name] = $dot
  New-Label $caption 44 $y 125 22 $fontBody $script:colors.Muted $connectionsCard | Out-Null
  $value = New-Label '检查中…' 170 $y 150 22 $fontBody $script:colors.Text $connectionsCard
  $script:valueLabels[$name] = $value
}

function Add-InfoRow([string]$name, [string]$caption, [int]$y) {
  New-Label $caption 16 $y 92 22 $fontBody $script:colors.Muted $infoCard | Out-Null
  $value = New-Label '—' 112 $y 220 22 $fontBody $script:colors.Text $infoCard
  $script:infoLabels[$name] = $value
}

function Set-DisconnectedState([string]$message) {
  Set-Badge '等待连接' $script:colors.Yellow
  Set-Value '服务状态' '未启动' $script:colors.Yellow
  Set-Value 'MCP 会话' '—' $script:colors.Muted
  Set-Value '工具数量' '—' $script:colors.Muted
  Set-Value 'Chrome 扩展' '未连接' $script:colors.Red
  Set-Value 'Native Host' '未连接' $script:colors.Red
  Set-Value '健康检查' '未检查' $script:colors.Muted
  Set-Info 'endpoint' "127.0.0.1:$Port/mcp"
  Set-Info 'port' "$Port"
  Set-Info 'activity' '暂无'
  Set-Info 'native' '等待 Chrome'
  $details.Text = "$message`r`n请确认 Chrome 扩展已加载；扩展连接后服务会自动启动。"
}

function Apply-Status([hashtable]$result, [bool]$probe) {
  if (-not $result.Ok -or -not $result.Json) {
    $errorText = if ($result.Error) { $result.Error } else { "HTTP $($result.Status)" }
    Set-DisconnectedState "服务尚未监听 $Port（$errorText）"
    return
  }

  $data = $result.Json
  $serverRunning = [bool]$data.server.serviceRunning
  $extensionConnected = [bool]$data.extension.connected
  $nativeConnected = [bool]$data.nativeHost.connected
  $serverText = if ($serverRunning -and $nativeConnected) { '运行中' } elseif ($serverRunning) { '等待 Chrome' } else { '已停止' }
  $serverColor = if ($serverRunning -and $nativeConnected) { $script:colors.Green } elseif ($serverRunning) { $script:colors.Yellow } else { $script:colors.Yellow }
  $extensionText = if ($extensionConnected) { '已连接' } else { '未连接' }
  $extensionColor = if ($extensionConnected) { $script:colors.Green } else { $script:colors.Red }
  $nativeText = if ($nativeConnected) { '已连接' } else { '等待连接' }
  $nativeColor = if ($nativeConnected) { $script:colors.Green } else { $script:colors.Yellow }

  Set-Badge $serverText $serverColor
  Set-Value '服务状态' $serverText $serverColor
  Set-Value 'MCP 会话' ([string]$data.mcp.activeSessions) $script:colors.Text
  Set-Value '工具数量' ([string]$data.tools.count) $script:colors.Text
  Set-Value 'Chrome 扩展' $extensionText $extensionColor
  Set-Value 'Native Host' $nativeText $nativeColor
  Set-Info 'endpoint' "127.0.0.1:$Port/mcp"
  Set-Info 'port' "$Port"
  Set-Info 'activity' $(if ($data.nativeHost.lastActivityAt) { [string]$data.nativeHost.lastActivityAt } else { '暂无' })
  Set-Info 'native' $(if ($nativeConnected) { $HostName } else { '等待 Chrome' })

  if ($probe) {
    if ($data.probe.ok) {
      Set-Value '健康检查' "正常 · $($data.probe.elapsedMs) ms" $script:colors.Green
    } else {
      Set-Value '健康检查' '失败 · Chrome 无响应' $script:colors.Red
    }
  } elseif ($serverRunning -and -not $nativeConnected) {
    Set-Value '健康检查' '无法检查 · Chrome 未连接' $script:colors.Yellow
  } elseif ($serverRunning) {
    Set-Value '健康检查' '点击按钮执行' $script:colors.Muted
  } else {
    Set-Value '健康检查' '服务已停止' $script:colors.Yellow
  }

  $details.Text = "服务地址：http://127.0.0.1:$Port/mcp`r`n扩展 ID：$ExtensionId`r`n最后活动：$(if ($data.nativeHost.lastActivityAt) { $data.nativeHost.lastActivityAt } else { '暂无' })"
}

function Set-RequestButtons([bool]$enabled) {
  $refreshButton.Enabled = $enabled
  $healthButton.Enabled = $enabled
}

function Update-Status([bool]$probe = $false) {
  if ($script:requestBusy) { return }
  $script:requestBusy = $true
  Set-RequestButtons $false
  $footer.Text = if ($probe) { '正在执行健康检查…' } else { '正在刷新状态…' }
  $script:statusWorker.RunWorkerAsync($probe)
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

$fontTitle = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
$fontSection = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$fontMetric = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$fontBody = New-Object System.Drawing.Font('Segoe UI', 9)
$fontSmall = New-Object System.Drawing.Font('Segoe UI', 8.5)

$form = New-Object System.Windows.Forms.Form
$form.Text = "Chrome MCP Bridge $Version"
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(760, 575)
$form.MinimumSize = New-Object System.Drawing.Size(760, 575)
$form.MaximumSize = New-Object System.Drawing.Size(760, 575)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.ShowInTaskbar = $true
$form.BackColor = $script:colors.Background
$form.ForeColor = $script:colors.Text
$form.KeyPreview = $true

$header = New-Object System.Windows.Forms.Panel
$header.Location = New-Object System.Drawing.Point(20, 18)
$header.Size = New-Object System.Drawing.Size(720, 82)
$header.BackColor = $script:colors.Surface
$header.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$form.Controls.Add($header)
New-Label "Chrome MCP Bridge" 18 12 400 30 $fontTitle $script:colors.Text $header | Out-Null
New-Label "本地服务管理器  ·  自动刷新 3 秒  ·  关闭窗口后继续驻留托盘" 20 47 500 20 $fontSmall $script:colors.Muted $header | Out-Null
$statusBadge = New-Label '  ●  检查中…  ' 565 24 135 32 $fontBody $script:colors.Yellow $header
$statusBadge.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$statusBadge.AutoEllipsis = $false

Add-MetricCard '服务状态' '服务状态' 20 116 230
Add-MetricCard 'MCP 会话' '活跃 MCP 会话' 265 116 230
Add-MetricCard '工具数量' '可用工具' 510 116 230

$connectionsCard = New-Card 20 220 350 150
New-Label '连接状态' 16 14 300 24 $fontSection $script:colors.Text $connectionsCard | Out-Null
Add-ConnectionRow 'Chrome 扩展' 'Chrome 扩展' 50
Add-ConnectionRow 'Native Host' 'Native Host' 80
Add-ConnectionRow '健康检查' '健康检查' 110

$infoCard = New-Card 385 220 355 150
New-Label '服务信息' 16 14 300 24 $fontSection $script:colors.Text $infoCard | Out-Null
Add-InfoRow 'endpoint' 'MCP 地址' 50
Add-InfoRow 'port' '端口' 80
Add-InfoRow 'native' '消息通道' 110

function New-ActionButton([string]$text, [int]$x, [System.Drawing.Color]$backColor = $script:colors.SurfaceAlt) {
  $button = New-Object System.Windows.Forms.Button
  $button.Text = $text
  $button.Location = New-Object System.Drawing.Point($x, 390)
  $button.Size = New-Object System.Drawing.Size(132, 36)
  $button.Font = $fontBody
  $button.BackColor = $backColor
  $button.ForeColor = $script:colors.Text
  $button.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $button.FlatAppearance.BorderColor = $script:colors.Border
  $button.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::FromArgb(48, 54, 68)
  $form.Controls.Add($button)
  return $button
}

$refreshButton = New-ActionButton '刷新状态' 20
$healthButton = New-ActionButton '健康检查' 168
$startButton = New-ActionButton '启动服务' 316 $script:colors.SurfaceAlt
$stopButton = New-ActionButton '停止服务' 464 $script:colors.SurfaceAlt
$logButton = New-ActionButton '打开日志' 612

$details = New-Object System.Windows.Forms.TextBox
$details.Location = New-Object System.Drawing.Point(20, 438)
$details.Size = New-Object System.Drawing.Size(720, 78)
$details.Multiline = $true
$details.ReadOnly = $true
$details.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
$details.BackColor = $script:colors.Surface
$details.ForeColor = $script:colors.Muted
$details.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$details.Font = New-Object System.Drawing.Font('Consolas', 8.5)
$form.Controls.Add($details)

$footer = New-Label "准备就绪  ·  F5 刷新状态" 20 532 720 20 $fontSmall $script:colors.Muted

$refreshButton.Add_Click({ Update-Status $false })
$healthButton.Add_Click({ Update-Status $true })
$startButton.Add_Click({ Invoke-Control '/__chrome_mcp_bridge/start' | Out-Null })
$stopButton.Add_Click({ Invoke-Control '/__chrome_mcp_bridge/stop' | Out-Null })
$logButton.Add_Click({
  if (-not $LogPath) { return }
  if (-not (Test-Path -LiteralPath $LogPath)) { New-Item -ItemType File -Path $LogPath -Force | Out-Null }
  Start-Process notepad.exe -ArgumentList $LogPath
})
$form.Add_KeyDown({
  param($sender, $eventArgs)
  if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::F5) { Update-Status $false }
})

$script:statusWorker = New-Object System.ComponentModel.BackgroundWorker
$script:statusWorker.WorkerSupportsCancellation = $false
$script:statusWorker.Add_DoWork({
  param($sender, $eventArgs)
  $probe = [bool]$eventArgs.Argument
  $path = if ($probe) { '/status?probe=1' } else { '/status' }
  $eventArgs.Result = @{ Probe = $probe; Result = (Invoke-BridgeRequest $path) }
})
$script:statusWorker.Add_RunWorkerCompleted({
  param($sender, $eventArgs)
  $script:requestBusy = $false
  Set-RequestButtons $true
  if ($eventArgs.Error) {
    Set-DisconnectedState "状态读取失败：$($eventArgs.Error.Message)"
  } else {
    Apply-Status $eventArgs.Result.Result ([bool]$eventArgs.Result.Probe)
  }
  $footer.Text = "上次刷新：$(Get-Date -Format 'HH:mm:ss')  ·  自动刷新 3 秒  ·  F5 手动刷新"
})

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
  if ($form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) { $form.Hide() }
})

$refreshTimer = New-Object System.Windows.Forms.Timer
$refreshTimer.Interval = 3000
$refreshTimer.Add_Tick({ Update-Status $false })
$refreshTimer.Start()

$startupTimer = New-Object System.Windows.Forms.Timer
$startupTimer.Interval = 600
$startupTimer.Add_Tick({
  $startupTimer.Stop()
  Invoke-Control '/__chrome_mcp_bridge/start' | Out-Null
})
$startupTimer.Start()

Set-DisconnectedState '正在连接本地服务…'
Update-Status $false
$form.Add_Shown({ $form.Activate() })
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
