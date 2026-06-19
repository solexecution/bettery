# Generates Bettery PNG icons (gradient background + white dumbbell).
Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot "icons"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

function Add-RoundRect($gp, $x, $y, $w, $h, $r) {
  $d = [float]($r * 2)
  $gp.AddArc($x, $y, $d, $d, 180, 90)
  $gp.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $gp.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $gp.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $gp.CloseFigure()
}

function New-Icon($size, $pad, $path) {
  $S = [int]$size
  $bmp = New-Object System.Drawing.Bitmap($S, $S)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  # gradient background
  $rect = New-Object System.Drawing.Rectangle(0, 0, $S, $S)
  $c1 = [System.Drawing.Color]::FromArgb(255, 71, 87)    # #ff4757
  $c2 = [System.Drawing.Color]::FromArgb(255, 122, 24)   # #ff7a18
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 50)
  $g.FillRectangle($bg, $rect)

  # dumbbell geometry
  $C  = [float]($S * (1 - 2 * $pad))
  $cx = [float]($S / 2)
  $cy = [float]($S / 2)
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath

  $bw = $C * 0.46; $bh = $C * 0.12
  Add-RoundRect $gp ($cx - $bw/2) ($cy - $bh/2) $bw $bh ($bh/2)

  $ow = $C * 0.13; $oh = $C * 0.48; $ox = $C * 0.30
  Add-RoundRect $gp ($cx - $ox - $ow/2) ($cy - $oh/2) $ow $oh ($ow*0.35)
  Add-RoundRect $gp ($cx + $ox - $ow/2) ($cy - $oh/2) $ow $oh ($ow*0.35)

  $iw = $C * 0.10; $ih = $C * 0.33; $ix = $C * 0.195
  Add-RoundRect $gp ($cx - $ix - $iw/2) ($cy - $ih/2) $iw $ih ($iw*0.35)
  Add-RoundRect $gp ($cx + $ix - $iw/2) ($cy - $ih/2) $iw $ih ($iw*0.35)

  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPath($white, $gp)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "wrote $path"
}

New-Icon 192 0.16 (Join-Path $dir "icon-192.png")
New-Icon 512 0.16 (Join-Path $dir "icon-512.png")
New-Icon 180 0.16 (Join-Path $dir "icon-180.png")
New-Icon 192 0.26 (Join-Path $dir "icon-maskable-192.png")
New-Icon 512 0.26 (Join-Path $dir "icon-maskable-512.png")
Write-Host "done"
