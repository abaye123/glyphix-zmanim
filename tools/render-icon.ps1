# Draws the app icon and the day arrows into the assets folder.
param([string]$OutDir)
Add-Type -AssemblyName System.Drawing

function New-Canvas($size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  return @($bmp, $g)
}

# App icon: a sun over the horizon.
$bmp, $g = New-Canvas 192
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(0, 0, 192, 192)), [System.Drawing.Color]::FromArgb(42, 31, 92), [System.Drawing.Color]::FromArgb(214, 96, 60), 90.0)
$g.FillEllipse($bg, 4, 4, 184, 184)
$gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 214, 90))
$g.FillEllipse($gold, 56, 66, 80, 80)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(42, 31, 92))), 24, 120, 144, 8)
$bmp.Save((Join-Path $OutDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)

# Day arrows: a rounded chevron, drawn large and scaled down so the edges stay smooth.
function Save-Chevron($name, $tipX, $backX) {
  $bmp, $g = New-Canvas 144
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 214, 90)), 18
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
  $points = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF($backX, 30)),
    (New-Object System.Drawing.PointF($tipX, 72)),
    (New-Object System.Drawing.PointF($backX, 114))
  )
  $g.DrawLines($pen, $points)
  $small = New-Object System.Drawing.Bitmap 36, 36
  $s = [System.Drawing.Graphics]::FromImage($small)
  $s.InterpolationMode = 'HighQualityBicubic'; $s.SmoothingMode = 'AntiAlias'
  $s.DrawImage($bmp, 0, 0, 36, 36)
  $small.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
}
Save-Chevron 'arrow-left.png' 48 96
Save-Chevron 'arrow-right.png' 96 48
