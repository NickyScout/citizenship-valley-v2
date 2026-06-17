# Processes the raw AI hero sprite sheet (assets/characters/characters-src or tiles-src)
# into a clean engine sheet: 4 cols (walk frames) x 4 rows (down,left,right,up), each cell
# 48x72, magenta (#FF00FF) cut to transparent, each frame trimmed and re-centered with feet
# on a common baseline so the walk cycle does not jitter. Output: assets/characters/hero-base.png
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path "$PSScriptRoot\..").Path
$src = Join-Path $root "assets\characters\characters-src\hero.png"
if (-not (Test-Path $src)) { $src = Join-Path $root "assets\tiles\tiles-src\hero.png" }
$outPath = Join-Path $root "assets\characters\hero-base.png"

$CELL_W = 48; $CELL_H = 72; $COLS = 4; $ROWS = 4
$BASELINE = 70   # feet sit here within each output cell
$TARGET_H = 66   # tallest frame scales to this many px

$sheet = [System.Drawing.Bitmap]::FromFile($src)
$cw = $sheet.Width / $COLS
$ch = $sheet.Height / $ROWS

function Test-Bg($p) {
  return ($p.R -gt 120 -and $p.B -gt 120 -and $p.G -lt ([Math]::Min($p.R, $p.B) - 40))
}

# Pass 1: per-cell content bbox + global max content height.
$boxes = @{}
$maxH = 1
for ($r = 0; $r -lt $ROWS; $r++) {
  for ($c = 0; $c -lt $COLS; $c++) {
    $ox = [int][Math]::Floor($c * $cw); $oy = [int][Math]::Floor($r * $ch)
    $ex = [int][Math]::Floor(($c + 1) * $cw) - 1; $ey = [int][Math]::Floor(($r + 1) * $ch) - 1
    $minX = $ex; $minY = $ey; $maxX = $ox; $maxY = $oy; $found = $false
    for ($y = $oy; $y -le $ey; $y++) {
      for ($x = $ox; $x -le $ex; $x++) {
        if (-not (Test-Bg $sheet.GetPixel($x, $y))) {
          $found = $true
          if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
          if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
        }
      }
    }
    if (-not $found) { $minX = $ox; $minY = $oy; $maxX = $ox + 1; $maxY = $oy + 1 }
    $boxes["$r,$c"] = @($minX, $minY, $maxX, $maxY)
    $h = $maxY - $minY + 1
    if ($h -gt $maxH) { $maxH = $h }
  }
}
$scale = $TARGET_H / $maxH
"hero src $($sheet.Width)x$($sheet.Height), cell ~$([int]$cw)x$([int]$ch), maxContentH $maxH, scale $([Math]::Round($scale,3))"

# Pass 2: build the output sheet.
$out = New-Object System.Drawing.Bitmap ($CELL_W * $COLS), ($CELL_H * $ROWS), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$go = [System.Drawing.Graphics]::FromImage($out)
$go.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$go.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
for ($r = 0; $r -lt $ROWS; $r++) {
  for ($c = 0; $c -lt $COLS; $c++) {
    $b = $boxes["$r,$c"]; $minX = $b[0]; $minY = $b[1]; $maxX = $b[2]; $maxY = $b[3]
    $bw = $maxX - $minX + 1; $bh = $maxY - $minY + 1
    # Trim cell content into a transparent bitmap (magenta -> alpha 0).
    $trim = New-Object System.Drawing.Bitmap $bw, $bh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt $bh; $y++) {
      for ($x = 0; $x -lt $bw; $x++) {
        $p = $sheet.GetPixel($minX + $x, $minY + $y)
        if (Test-Bg $p) { $trim.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
        else { $trim.SetPixel($x, $y, $p) }
      }
    }
    $dw = [int][Math]::Round($bw * $scale); $dh = [int][Math]::Round($bh * $scale)
    $dx = [int]($c * $CELL_W + ($CELL_W - $dw) / 2)         # horizontally centred
    $dy = [int]($r * $CELL_H + $BASELINE - $dh)             # feet on the baseline
    $go.DrawImage($trim, (New-Object System.Drawing.Rectangle $dx, $dy, $dw, $dh))
    $trim.Dispose()
  }
}
$go.Dispose()

# Harden alpha fringe from the scale.
for ($y = 0; $y -lt $out.Height; $y++) {
  for ($x = 0; $x -lt $out.Width; $x++) {
    $p = $out.GetPixel($x, $y)
    if ($p.A -eq 0) { continue }
    if ($p.A -lt 110) { $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
    elseif ($p.A -lt 255) { $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B)) }
  }
}
$out.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
"hero -> hero-base.png $($out.Width)x$($out.Height) (cell ${CELL_W}x${CELL_H})"
$sheet.Dispose(); $out.Dispose()
"done"
