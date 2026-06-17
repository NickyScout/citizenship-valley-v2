# Processes the raw AI hero sprite sheet (assets/characters/characters-src/hero.png) into a
# clean engine sheet: 4 cols (walk frames) x 4 rows (down,left,right,up), each cell 48x72,
# magenta (#FF00FF) cut to transparent. Each frame is trimmed to its body and re-placed with
# feet on a common baseline so the walk cycle does not jitter or float.
#   Feet detection walks DOWN from the head through small gaps (belt) but stops at a LARGE
#   gap, so a thin magenta-fringe artifact near a cell edge is never mistaken for the feet.
# NOTE: PowerShell variables are CASE-INSENSITIVE — never use $bH and $bh as different vars.
# Output: assets/characters/hero-base.png
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path "$PSScriptRoot\..").Path
$srcPath = Join-Path $root "assets\characters\characters-src\hero.png"
if (-not (Test-Path $srcPath)) { $srcPath = Join-Path $root "assets\tiles\tiles-src\hero.png" }
$outPath = Join-Path $root "assets\characters\hero-base.png"

[int]$cellW = 48; [int]$cellH = 72; [int]$cols = 4; [int]$rows = 4
[int]$baseline = 69     # feet sit here within each output cell
[int]$targetH = 64      # tallest body scales to this many px
[int]$minRun = 4        # a row needs this many opaque px to count as body (ignores fringe)

$sheet = [System.Drawing.Bitmap]::FromFile($srcPath)
[int]$sw = $sheet.Width; [int]$sh = $sheet.Height

function Test-Magenta($px) {
  return ($px.R -gt 110 -and $px.B -gt 110 -and $px.G -lt ([Math]::Min($px.R, $px.B) - 30))
}

# Working copy: magenta -> transparent, else opaque-copied. Pass 2 reads this.
$work = New-Object System.Drawing.Bitmap $sw, $sh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ([int]$yy = 0; $yy -lt $sh; $yy++) {
  for ([int]$xx = 0; $xx -lt $sw; $xx++) {
    $px = $sheet.GetPixel($xx, $yy)
    if (Test-Magenta $px) { $work.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
    else { $work.SetPixel($xx, $yy, $px) }
  }
}
$sheet.Dispose()

# Pass 1: per-cell body box stored as PSCustomObjects in a flat list (index r*cols+c).
$boxes = New-Object System.Collections.ArrayList
[int]$maxBodyH = 1
for ([int]$r = 0; $r -lt $rows; $r++) {
  for ([int]$c = 0; $c -lt $cols; $c++) {
    [int]$ox = [Math]::Floor($c * $sw / $cols); [int]$oy = [Math]::Floor($r * $sh / $rows)
    [int]$ex = [Math]::Floor(($c + 1) * $sw / $cols) - 1; [int]$ey = [Math]::Floor(($r + 1) * $sh / $rows) - 1
    [int]$cellRows = $ey - $oy + 1
    [int]$gapMax = [Math]::Floor($cellRows * 0.12)
    $rowCount = New-Object 'int[]' $cellRows
    for ([int]$yy = $oy; $yy -le $ey; $yy++) {
      [int]$cnt = 0
      for ([int]$xx = $ox; $xx -le $ex; $xx++) { if ($work.GetPixel($xx, $yy).A -gt 40) { $cnt++ } }
      $rowCount[$yy - $oy] = $cnt
    }
    [int]$top = -1
    for ([int]$i = 0; $i -lt $cellRows; $i++) { if ($rowCount[$i] -ge $minRun) { $top = $i; break } }
    if ($top -lt 0) { for ([int]$i = 0; $i -lt $cellRows; $i++) { if ($rowCount[$i] -ge 1) { $top = $i; break } } }
    if ($top -lt 0) { $top = 0 }
    [int]$bottom = $top; [int]$gap = 0
    for ([int]$i = $top + 1; $i -lt $cellRows; $i++) {
      if ($rowCount[$i] -ge $minRun) { $bottom = $i; $gap = 0 } else { $gap++; if ($gap -gt $gapMax) { break } }
    }
    [int]$leftX = -1; [int]$rightX = -1
    for ([int]$xx = $ox; $xx -le $ex; $xx++) {
      [bool]$hit = $false
      for ([int]$yy = $oy + $top; $yy -le $oy + $bottom; $yy++) { if ($work.GetPixel($xx, $yy).A -gt 40) { $hit = $true; break } }
      if ($hit) { if ($leftX -lt 0) { $leftX = $xx }; $rightX = $xx }
    }
    if ($leftX -lt 0) { $leftX = $ox; $rightX = $ox + 1 }
    [int]$boxBodyH = $bottom - $top + 1
    [void]$boxes.Add([pscustomobject]@{ X = $leftX; Y = ($oy + $top); W = ($rightX - $leftX + 1); H = $boxBodyH })
    if ($boxBodyH -gt $maxBodyH) { $maxBodyH = $boxBodyH }
  }
}
$scale = $targetH / $maxBodyH
"hero src ${sw}x${sh}, maxBodyH $maxBodyH, scale $([Math]::Round($scale,3))"

# Pass 2: scale each body into its 48x72 cell, feet on baseline, horizontally centred.
$out = New-Object System.Drawing.Bitmap ($cellW * $cols), ($cellH * $rows), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($out)
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
for ([int]$r = 0; $r -lt $rows; $r++) {
  for ([int]$c = 0; $c -lt $cols; $c++) {
    $box = $boxes[$r * $cols + $c]
    $crop = $work.Clone((New-Object System.Drawing.Rectangle ([int]$box.X), ([int]$box.Y), ([int]$box.W), ([int]$box.H)), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    [int]$dw = [Math]::Round($box.W * $scale); [int]$dh = [Math]::Round($box.H * $scale)
    [int]$dx = $c * $cellW + [Math]::Round(($cellW - $dw) / 2)
    [int]$dy = $r * $cellH + $baseline - $dh
    $gfx.DrawImage($crop, (New-Object System.Drawing.Rectangle $dx, $dy, $dw, $dh))
    $crop.Dispose()
  }
}
$gfx.Dispose()
$work.Dispose()

# Harden the alpha fringe left by the high-quality scale.
for ([int]$yy = 0; $yy -lt $out.Height; $yy++) {
  for ([int]$xx = 0; $xx -lt $out.Width; $xx++) {
    $px = $out.GetPixel($xx, $yy)
    if ($px.A -eq 0) { continue }
    if ($px.A -lt 110) { $out.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
    elseif ($px.A -lt 255) { $out.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb(255, $px.R, $px.G, $px.B)) }
  }
}
$out.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
"hero -> hero-base.png $($out.Width)x$($out.Height) (cell ${cellW}x${cellH})"
$out.Dispose()
"done"
