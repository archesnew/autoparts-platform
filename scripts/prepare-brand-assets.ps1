Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$brand = Join-Path $root "public/brand"
$masterPath = Join-Path $brand "zaptut-logo-master.png"
if (-not (Test-Path -LiteralPath $masterPath)) {
  throw "Missing approved source logo: $masterPath"
}

function Get-Crop([System.Drawing.Bitmap]$Source, [int]$X, [int]$Y, [int]$Width, [int]$Height) {
  return $Source.Clone(
    [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height),
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
}

function Save-RecoloredPng([System.Drawing.Bitmap]$Bitmap, [string]$Path, [bool]$LightSurface, [bool]$RemoveScrew) {
  $rect = [System.Drawing.Rectangle]::new(0, 0, $Bitmap.Width, $Bitmap.Height)
  $data = $Bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $bytes = New-Object byte[] ($data.Stride * $data.Height)
    [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
      for ($x = 0; $x -lt $Bitmap.Width; $x++) {
        $index = $y * $data.Stride + $x * 4
        if ($RemoveScrew -and $x -ge 2462 -and $y -lt 249) {
          $bytes[$index + 3] = 0
          continue
        }
        if ($bytes[$index + 3] -eq 0) { continue }

        $red = $bytes[$index + 2]
        $green = $bytes[$index + 1]
        $blue = $bytes[$index]
        if ($red -eq 241 -and $green -eq 240 -and $blue -eq 234) {
          if ($LightSurface) {
            $bytes[$index + 2] = 23
            $bytes[$index + 1] = 25
            $bytes[$index] = 27
          } else {
            $bytes[$index + 2] = 241
            $bytes[$index + 1] = 240
            $bytes[$index] = 235
          }
        } elseif ($red -eq 236 -and $green -eq 102 -and $blue -eq 51) {
          $bytes[$index + 2] = 255
          $bytes[$index + 1] = 100
          $bytes[$index] = 40
        }
      }
    }
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
  } finally {
    $Bitmap.UnlockBits($data)
  }
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-AppIcon([System.Drawing.Bitmap]$Screw, [string]$Path, [int]$Size) {
  $canvas = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(23, 25, 27))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $padding = [Math]::Round($Size * 0.12)
    $available = $Size - 2 * $padding
    $scale = [Math]::Min($available / $Screw.Width, $available / $Screw.Height)
    $width = [Math]::Round($Screw.Width * $scale)
    $height = [Math]::Round($Screw.Height * $scale)
    $x = [Math]::Round(($Size - $width) / 2)
    $y = [Math]::Round(($Size - $height) / 2)
    $graphics.DrawImage($Screw, [System.Drawing.Rectangle]::new($x, $y, $width, $height))
    $canvas.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $canvas.Dispose()
  }
}

$source = [System.Drawing.Bitmap]::FromFile($masterPath)
$logo = $null
$lightLogo = $null
$loaderLogo = $null
$screw = $null
try {
  # Exact bounds of non-transparent brand artwork in the supplied master.
  $logo = Get-Crop $source 450 548 2717 249
  $lightLogo = Get-Crop $source 450 548 2717 249
  $loaderLogo = Get-Crop $source 450 548 2717 249
  # Screw mark, plus a small transparent safety margin for rotation.
  $screw = Get-Crop $source 2898 534 283 277

  Save-RecoloredPng $logo (Join-Path $brand "zaptut-logo-dark.png") $false $false
  Save-RecoloredPng $lightLogo (Join-Path $brand "zaptut-logo-light.png") $true $false
  Save-RecoloredPng $loaderLogo (Join-Path $brand "zaptut-logo-loader-base.png") $false $true
  Save-RecoloredPng $screw (Join-Path $brand "zaptut-screw.png") $false $false
  Save-AppIcon $screw (Join-Path $root "src/app/icon.png") 64
  Save-AppIcon $screw (Join-Path $root "src/app/apple-icon.png") 180
} finally {
  foreach ($bitmap in @($source, $logo, $lightLogo, $loaderLogo, $screw)) {
    if ($null -ne $bitmap) { $bitmap.Dispose() }
  }
}

Get-ChildItem $brand -Filter "zaptut-*.png" | Select-Object Name, Length
