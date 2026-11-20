# Renders the app icons (PNG) with Windows GDI+ — same geometry as icons/icon.svg.
# Usage (from the project root):  powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function Draw-Icon([int]$size, [string]$file, [bool]$rounded) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = $size / 100.0
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#4146B5'))
  if ($rounded) {
    # Rounded square (radius 22 units) for "any" purpose icons
    $r = 22 * $s; $d = 2 * $r; $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, $d, $d, 180, 90); $p.AddArc($size - $d, 0, $d, $d, 270, 90)
    $p.AddArc($size - $d, $size - $d, $d, $d, 0, 90); $p.AddArc(0, $size - $d, $d, $d, 90, 90)
    $p.CloseFigure(); $g.FillPath($bg, $p)
  } else { $g.FillRectangle($bg, 0, 0, $size, $size) }

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FAF7F2'))
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#FAF7F2')), (5 * $s)
  $pen.LineJoin = 'Round'
  function P($x, $y) { New-Object System.Drawing.PointF ([float]($x * $s)), ([float]($y * $s)) }
  # Open book: two pages
  $left  = [System.Drawing.PointF[]]@((P 24 33), (P 47 38), (P 47 73), (P 24 68))
  $right = [System.Drawing.PointF[]]@((P 53 38), (P 76 33), (P 76 68), (P 53 73))
  foreach ($pg in @($left, $right)) { $g.FillPolygon($white, $pg); $g.DrawPolygon($pen, $pg) }
  # Text lines on the left page
  $line = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#B9BCEB')), (2.6 * $s)
  $line.StartCap = 'Round'; $line.EndCap = 'Round'
  foreach ($y in @(46, 53, 60)) { $g.DrawLine($line, (P 29 ($y - 4)), (P 42 ($y - 1))) }
  # Green bookmark on the right page (success accent)
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#3E9A6B'))
  $bm = [System.Drawing.PointF[]]@((P 62 36), (P 70 34.2), (P 70 54), (P 66 50.5), (P 62 55.8))
  $g.FillPolygon($green, $bm)

  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Draw-Icon 180 'apple-touch-icon-180.png' $false   # iOS rounds corners itself
Draw-Icon 192 'icon-192.png' $true
Draw-Icon 512 'icon-512.png' $true
Draw-Icon 512 'maskable-512.png' $false            # full bleed; artwork sits inside the safe zone
Write-Output "Icons written to $out"
