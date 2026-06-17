# Processes raw AI-generated tile art (assets/tiles/tiles-src) into game-ready PNGs.
# - grass: downscale to a 48x48 seamless tile.
# - tree:  magenta (#FF00FF) background -> transparent, crop to content, downscale to ~96px wide.
# Uses System.Drawing (Windows). Re-run after dropping new raw art in tiles-src.
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path "$PSScriptRoot\..").Path
$srcDir = Join-Path $root "assets\tiles\tiles-src"
$outDir = Join-Path $root "assets\tiles"

function Save-Png($bmp, $path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

# --- Opaque 48x48 ground tiles: high-quality downscale (no transparency) ---
# Maps raw source filename -> runtime TILE_ASSETS filename.
$tiles = @{ "grass" = "tile-grass"; "road" = "tile-road"; "plaza" = "tile-plaza"; "water" = "tile-water"; "dock" = "tile-dock"; "wall" = "tile-wall" }
foreach ($name in $tiles.Keys) {
  $srcPath = Join-Path $srcDir "$name.png"
  if (-not (Test-Path $srcPath)) { "skip $name (no source)"; continue }
  $src = [System.Drawing.Bitmap]::FromFile($srcPath)
  $bmp = New-Object System.Drawing.Bitmap 48, 48, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gg = [System.Drawing.Graphics]::FromImage($bmp)
  $gg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gg.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, 48, 48))
  $gg.Dispose()
  Save-Png $bmp (Join-Path $outDir "$($tiles[$name]).png")
  "$name -> $($tiles[$name]).png 48x48"
  $src.Dispose(); $bmp.Dispose()
}

# --- TREE: cut magenta, crop to content, downscale to width 96 (keep aspect) ---
$treeSrc = [System.Drawing.Bitmap]::FromFile((Join-Path $srcDir "tree.png"))
$w = $treeSrc.Width; $h = $treeSrc.Height
$full = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$minX = $w; $minY = $h; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $p = $treeSrc.GetPixel($x, $y)
    $r = $p.R; $gg = $p.G; $b = $p.B
    # "magenta-ness": high red+blue, low green relative to them => background.
    $isBg = ($r -gt 120 -and $b -gt 120 -and $gg -lt ([Math]::Min($r, $b) - 40))
    if ($isBg) {
      # kill the magenta colour under the alpha so a later resize cannot bleed pink edges.
      $full.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 47, 122, 63))
    } else {
      $full.SetPixel($x, $y, $p)
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
"tree content bbox: ${cw}x${ch} at ($minX,$minY)"
$crop = $full.Clone((New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$tw = 96
$th = [int][Math]::Round($ch * ($tw / $cw))
$tree = New-Object System.Drawing.Bitmap $tw, $th, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gt = [System.Drawing.Graphics]::FromImage($tree)
$gt.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gt.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gt.DrawImage($crop, (New-Object System.Drawing.Rectangle 0, 0, $tw, $th))
$gt.Dispose()
# Harden alpha: drop the semi-transparent fringe left by the downscale.
for ($y = 0; $y -lt $th; $y++) {
  for ($x = 0; $x -lt $tw; $x++) {
    $p = $tree.GetPixel($x, $y)
    if ($p.A -lt 110) { $tree.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
    elseif ($p.A -lt 255) { $tree.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B)) }
  }
}
Save-Png $tree (Join-Path $outDir "tree-oak.png")
"tree -> tree-oak.png ${tw}x${th}"

$treeSrc.Dispose(); $full.Dispose(); $crop.Dispose(); $tree.Dispose()
"done"
