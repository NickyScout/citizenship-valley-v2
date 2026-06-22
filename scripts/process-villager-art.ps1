# Processes the raw AI villager sprite sheet (assets/characters/characters-src/vilager.png) into a
# clean engine sheet: 4 cols (walk frames) x 4 rows (down,left,right,up), each cell 48x72, magenta
# (#FF00FF) cut to transparent, each body trimmed and re-placed with feet on a common baseline.
# Same proven pipeline as process-hero-art.ps1 but reads alpha from a LockBits byte buffer so the
# full-res magenta scan + feet detection run in seconds instead of minutes.
#   Feet detection walks DOWN from the head through small gaps (belt) but stops at a LARGE gap, so
#   a thin magenta-fringe artifact near a cell edge is never mistaken for the feet.
# NOTE: PowerShell variables are CASE-INSENSITIVE — never use $bH and $bh as different vars.
# Output: assets/characters/villager-base.png (neutral grey tunic, tinted per-role at runtime).
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path "$PSScriptRoot\..").Path
$srcPath = Join-Path $root "assets\characters\characters-src\vilager.png"
if (-not (Test-Path $srcPath)) { $srcPath = Join-Path $root "assets\characters\characters-src\villager.png" }
$outPath = Join-Path $root "assets\characters\villager-base.png"

[int]$cellW = 48; [int]$cellH = 72; [int]$cols = 4; [int]$rows = 4
[int]$baseline = 69     # feet sit here within each output cell
[int]$targetH = 64      # tallest body scales to this many px
[int]$minRun = 4        # a row needs this many opaque px to count as body (ignores fringe)

# --- Load into a lockable 32bpp ARGB bitmap ---
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
[int]$sw = $src.Width; [int]$sh = $src.Height
$work = New-Object System.Drawing.Bitmap $sw, $sh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g0 = [System.Drawing.Graphics]::FromImage($work)
$g0.DrawImageUnscaled($src, 0, 0)
$g0.Dispose(); $src.Dispose()

$lockRect = New-Object System.Drawing.Rectangle 0, 0, $sw, $sh
$bd = $work.LockBits($lockRect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
[int]$stride = $bd.Stride
[int]$bytes = $stride * $sh
$buf = New-Object byte[] $bytes
[System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $buf, 0, $bytes)
# magenta (#FF00FF-ish) background -> transparent, in the byte buffer (B,G,R,A per pixel).
for ([int]$y = 0; $y -lt $sh; $y++) {
  [int]$row = $y * $stride
  for ([int]$x = 0; $x -lt $sw; $x++) {
    [int]$i = $row + $x * 4
    [int]$b = $buf[$i]; [int]$gr = $buf[$i + 1]; [int]$r = $buf[$i + 2]
    if ($r -gt 110 -and $b -gt 110 -and $gr -lt ([Math]::Min($r, $b) - 30)) { $buf[$i + 3] = 0 }
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $bd.Scan0, $bytes)
$work.UnlockBits($bd)   # $work now has transparent background; $buf still holds the same alpha for fast reads

function Get-Alpha([int]$x, [int]$y) { return $buf[$y * $stride + $x * 4 + 3] }

# Pass 1: per-cell body box (gap-tolerant feet detection), stored as PSCustomObjects.
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
      for ([int]$xx = $ox; $xx -le $ex; $xx++) { if ((Get-Alpha $xx $yy) -gt 40) { $cnt++ } }
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
      for ([int]$yy = $oy + $top; $yy -le $oy + $bottom; $yy++) { if ((Get-Alpha $xx $yy) -gt 40) { $hit = $true; break } }
      if ($hit) { if ($leftX -lt 0) { $leftX = $xx }; $rightX = $xx }
    }
    if ($leftX -lt 0) { $leftX = $ox; $rightX = $ox + 1 }
    [int]$boxBodyH = $bottom - $top + 1
    [void]$boxes.Add([pscustomobject]@{ X = $leftX; Y = ($oy + $top); W = ($rightX - $leftX + 1); H = $boxBodyH })
    if ($boxBodyH -gt $maxBodyH) { $maxBodyH = $boxBodyH }
  }
}
$scale = $targetH / $maxBodyH
"villager src ${sw}x${sh}, maxBodyH $maxBodyH, scale $([Math]::Round($scale,3))"

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
"villager -> villager-base.png $($out.Width)x$($out.Height) (cell ${cellW}x${cellH})"
$out.Dispose()
"done"
