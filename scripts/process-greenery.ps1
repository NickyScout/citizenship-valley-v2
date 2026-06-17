# Processes raw AI greenery art (assets/tiles/tiles-src) into game-ready transparent PNGs.
#   bush.png        -> assets/tiles/bush.png        (round shrub, ~84px wide)
#   tree-small.png  -> assets/tiles/tree-small.png  (compact sapling for map "T" tiles, ~54px wide)
# Magenta (#FF00FF) background is cut to transparent, content is cropped, then high-quality
# downscaled and the alpha fringe is hardened. Uses LockBits so the full-res magenta scan is fast.
# Author size = logical draw width x 1.5 (RENDER_SCALE) so pixels land 1:1 in-engine.
# Re-run after dropping new raw art in tiles-src.
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path "$PSScriptRoot\..").Path
$srcDir = Join-Path $root "assets\tiles\tiles-src"
$outDir = Join-Path $root "assets\tiles"

function Convert-Greenery([string]$srcName, [string]$outName, [int]$targetW) {
  $srcPath = Join-Path $srcDir $srcName
  if (-not (Test-Path $srcPath)) { "skip $srcName (no source)"; return }

  $src = [System.Drawing.Bitmap]::FromFile($srcPath)
  [int]$w = $src.Width; [int]$h = $src.Height
  # Copy into a 32bpp ARGB working bitmap we can lock.
  $work = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g0 = [System.Drawing.Graphics]::FromImage($work)
  $g0.DrawImageUnscaled($src, 0, 0)
  $g0.Dispose(); $src.Dispose()

  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $bd = $work.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  [int]$stride = $bd.Stride
  [int]$bytes = $stride * $h
  $buf = New-Object byte[] $bytes
  [System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $buf, 0, $bytes)

  [int]$minX = $w; [int]$minY = $h; [int]$maxX = 0; [int]$maxY = 0
  for ([int]$y = 0; $y -lt $h; $y++) {
    [int]$row = $y * $stride
    for ([int]$x = 0; $x -lt $w; $x++) {
      [int]$i = $row + $x * 4   # B,G,R,A
      [int]$b = $buf[$i]; [int]$gr = $buf[$i + 1]; [int]$r = $buf[$i + 2]
      if ($r -gt 120 -and $b -gt 120 -and $gr -lt ([Math]::Min($r, $b) - 40)) {
        # magenta background -> transparent; recolour to mid-green so a later resize can't bleed pink.
        $buf[$i] = 63; $buf[$i + 1] = 122; $buf[$i + 2] = 47; $buf[$i + 3] = 0
      } else {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $bd.Scan0, $bytes)
  $work.UnlockBits($bd)

  if ($maxX -lt $minX) { "no content in $srcName"; $work.Dispose(); return }
  [int]$cw = $maxX - $minX + 1; [int]$ch = $maxY - $minY + 1
  "$srcName content bbox: ${cw}x${ch} at ($minX,$minY)  aspect $([Math]::Round($ch/$cw,3))"

  $crop = $work.Clone((New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $work.Dispose()
  [int]$tw = $targetW
  [int]$th = [int][Math]::Round($ch * ($tw / $cw))
  $out = New-Object System.Drawing.Bitmap $tw, $th, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gt = [System.Drawing.Graphics]::FromImage($out)
  $gt.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gt.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gt.DrawImage($crop, (New-Object System.Drawing.Rectangle 0, 0, $tw, $th))
  $gt.Dispose(); $crop.Dispose()

  # Harden the alpha fringe left by the downscale (small image, GetPixel is fine).
  for ([int]$y = 0; $y -lt $th; $y++) {
    for ([int]$x = 0; $x -lt $tw; $x++) {
      $p = $out.GetPixel($x, $y)
      if ($p.A -eq 0) { continue }
      if ($p.A -lt 110) { $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
      elseif ($p.A -lt 255) { $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B)) }
    }
  }
  $out.Save((Join-Path $outDir $outName), [System.Drawing.Imaging.ImageFormat]::Png)
  "$srcName -> $outName ${tw}x${th}"
  $out.Dispose()
}

Convert-Greenery "bush.png" "bush.png" 84
Convert-Greenery "tree-small.png" "tree-small.png" 54
"done"
