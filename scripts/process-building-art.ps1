# Processes raw AI building art (assets/buildings/buildings-src) into game-ready transparent PNGs.
#   building-<kind>.png  ->  assets/buildings/building-<kind>.png
# Magenta (#FF00FF) background is cut to transparent, content is cropped to its bounding box,
# then high-quality downscaled to a standard width (keeping aspect) and the alpha fringe is
# hardened. The engine stretches each facade into its building box (which varies per instance),
# so a generous source width keeps the in-engine downscale crisp.
# Uses LockBits so the full-res magenta scan is fast. Re-run after dropping new raw art.
# Kinds: townhall, court, library, press, police, garden, exam, campaign, generic.
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path "$PSScriptRoot\..").Path
$srcDir = Join-Path $root "assets\buildings\buildings-src"
$outDir = Join-Path $root "assets\buildings"
[int]$targetW = 256   # output facade width in px (height follows aspect)

$kinds = @("townhall", "court", "library", "press", "police", "garden", "exam", "campaign", "generic")

foreach ($kind in $kinds) {
  $srcPath = Join-Path $srcDir "building-$kind.png"
  if (-not (Test-Path $srcPath)) { "skip $kind (no source)"; continue }

  $src = [System.Drawing.Bitmap]::FromFile($srcPath)
  [int]$w = $src.Width; [int]$h = $src.Height
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
        # magenta background -> transparent; recolour to neutral so a later resize can't bleed pink.
        $buf[$i] = 90; $buf[$i + 1] = 96; $buf[$i + 2] = 98; $buf[$i + 3] = 0
      } else {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $bd.Scan0, $bytes)
  $work.UnlockBits($bd)

  if ($maxX -lt $minX) { "no content in building-$kind.png"; $work.Dispose(); continue }
  [int]$cw = $maxX - $minX + 1; [int]$ch = $maxY - $minY + 1
  "building-$kind content bbox: ${cw}x${ch} at ($minX,$minY)  aspect $([Math]::Round($ch/$cw,3))"

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

  # Harden the alpha fringe left by the downscale.
  for ([int]$y = 0; $y -lt $th; $y++) {
    for ([int]$x = 0; $x -lt $tw; $x++) {
      $p = $out.GetPixel($x, $y)
      if ($p.A -eq 0) { continue }
      if ($p.A -lt 110) { $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
      elseif ($p.A -lt 255) { $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B)) }
    }
  }
  $out.Save((Join-Path $outDir "building-$kind.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  "building-$kind -> building-$kind.png ${tw}x${th}"
  $out.Dispose()
}
"done"
