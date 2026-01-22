# Advanced App Icon Generator
# Supports multiple source images for different purposes:
# - Main icon (with golden border)
# - Adaptive icon foreground (circular crop)
# - Adaptive icon background (gradient or image)
# - Favicon (simplified)

Write-Host "=== Advanced App Icon Generator ===" -ForegroundColor Cyan
Write-Host ""

# Define source images for different purposes
$mainIcon = $null
$foregroundIcon = $null
$backgroundIcon = $null
$faviconSource = $null

# Check for main icon (with border - best quality)
$mainOptions = @("app-icon-main.png", "app-icon.png", "money-plant-icon.png", "new-icon.png", "app-icon.jpg")
foreach ($img in $mainOptions) {
    if (Test-Path $img) {
        $mainIcon = $img
        break
    }
}

# Check for foreground icon (without border)
$foregroundOptions = @("app-icon-foreground.png", "app-icon-main.png", "app-icon.png")
foreach ($img in $foregroundOptions) {
    if (Test-Path $img) {
        $foregroundIcon = $img
        break
    }
}

# Check for background (gradient or landscape)
$backgroundOptions = @("app-icon-background.png", "background-gradient.png", "landscape.png", "app-icon-main.png")
foreach ($img in $backgroundOptions) {
    if (Test-Path $img) {
        $backgroundIcon = $img
        break
    }
}

# Check for favicon source
$faviconOptions = @("favicon-source.png", "app-icon-circular.png", "app-icon-main.png", "app-icon.png")
foreach ($img in $faviconOptions) {
    if (Test-Path $img) {
        $faviconSource = $img
        break
    }
}

# Use main icon as fallback for missing images
if (-not $foregroundIcon) { $foregroundIcon = $mainIcon }
if (-not $faviconSource) { $faviconSource = $mainIcon }

if (-not $mainIcon) {
    Write-Host "Error: No main icon image found!" -ForegroundColor Red
    Write-Host "Please save your main icon as one of:" -ForegroundColor Yellow
    Write-Host "  - app-icon-main.png" -ForegroundColor White
    Write-Host "  - app-icon.png" -ForegroundColor White
    Write-Host "  - money-plant-icon.png" -ForegroundColor White
    exit 1
}

Write-Host "Source images:" -ForegroundColor Cyan
Write-Host "  Main Icon: $mainIcon" -ForegroundColor White
Write-Host "  Foreground: $foregroundIcon" -ForegroundColor White
Write-Host "  Background: $(if ($backgroundIcon) { $backgroundIcon } else { 'Green gradient (auto-generated)' })" -ForegroundColor White
Write-Host "  Favicon: $faviconSource" -ForegroundColor White
Write-Host ""

Add-Type -AssemblyName System.Drawing

# Function to resize image with high quality and gold border
function Resize-Image-Enhanced {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height,
        [System.Drawing.Color]$BorderColor,
        [int]$BorderThickness,
        [bool]$MaintainAspectRatio = $true
    )
    
    try {
        $image = [System.Drawing.Image]::FromFile($InputPath)
        
        if ($MaintainAspectRatio) {
            $ratio = [Math]::Min($Width / $image.Width, $Height / $image.Height)
            $newWidth = [int]($image.Width * $ratio)
            $newHeight = [int]($image.Height * $ratio)
        } else {
            $newWidth = $Width
            $newHeight = $Height
        }
        
        $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # Center the image
        $x = ($Width - $newWidth) / 2
        $y = ($Height - $newHeight) / 2
        
        # Draw image with padding for border
        $padding = $BorderThickness
        $imgX = $x + $padding
        $imgY = $y + $padding
        $imgW = $newWidth - ($padding * 2)
        $imgH = $newHeight - ($padding * 2)
        
        if ($imgW -gt 0 -and $imgH -gt 0) {
            $graphics.DrawImage($image, $imgX, $imgY, $imgW, $imgH)
        }
        
        # Draw border
        if ($BorderThickness -gt 0) {
            $pen = New-Object System.Drawing.Pen($BorderColor, $BorderThickness)
            $pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
            $graphics.DrawRectangle($pen, $BorderThickness / 2, $BorderThickness / 2, $Width - $BorderThickness, $Height - $BorderThickness)
            $pen.Dispose()
        }
        
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()
        
        return $true
    } catch {
        Write-Host "Error processing image: $_" -ForegroundColor Red
        return $false
    }
}

# Function to create adaptive icon background from image or gradient
function Create-AdaptiveBackground {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Size
    )
    
    try {
        $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        if ($InputPath -and (Test-Path $InputPath)) {
            $image = [System.Drawing.Image]::FromFile($InputPath)
            $graphics.DrawImage($image, 0, 0, $Size, $Size)
            $image.Dispose()
        } else {
            # Create green gradient background (bright green to dark green)
            $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
                [System.Drawing.Point]::new(0, 0),
                [System.Drawing.Point]::new(0, $Size),
                [System.Drawing.Color]::FromArgb(255, 76, 175, 80),  # Bright green (#4CAF50)
                [System.Drawing.Color]::FromArgb(255, 27, 94, 32)  # Dark green (#1B5E20)
            )
            $graphics.FillRectangle($brush, 0, 0, $Size, $Size)
            $brush.Dispose()
        }
        
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()
        
        return $true
    } catch {
        Write-Host "Error creating background: $_" -ForegroundColor Red
        return $false
    }
}

# Function to create adaptive icon foreground (circular crop with safe zone)
function Create-AdaptiveForeground {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Size
    )
    
    try {
        $image = [System.Drawing.Image]::FromFile($InputPath)
        $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # Android adaptive icons use 80% safe zone (20% can be cropped)
        $safeZone = $Size * 0.8
        $offset = ($Size - $safeZone) / 2
        
        # Create circular mask
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse($offset, $offset, $safeZone, $safeZone)
        $graphics.SetClip($path)
        
        # Scale and center image within safe zone
        $scale = [Math]::Min($safeZone / $image.Width, $safeZone / $image.Height)
        $scaledWidth = [int]($image.Width * $scale)
        $scaledHeight = [int]($image.Height * $scale)
        $x = ($Size - $scaledWidth) / 2
        $y = ($Size - $scaledHeight) / 2
        
        $graphics.DrawImage($image, $x, $y, $scaledWidth, $scaledHeight)
        
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()
        $path.Dispose()
        
        return $true
    } catch {
        Write-Host "Error creating foreground: $_" -ForegroundColor Red
        return $false
    }
}

# Function to create circular foreground for round icons
function Create-CircularForeground {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Size,
        [System.Drawing.Color]$BorderColor,
        [int]$BorderThickness
    )
    
    try {
        $image = [System.Drawing.Image]::FromFile($InputPath)
        $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # Create circular path
        $borderWidth = $BorderThickness
        $innerSize = $Size - ($borderWidth * 2)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse($borderWidth, $borderWidth, $innerSize, $innerSize)
        $graphics.SetClip($path)
        
        # Draw image
        $scale = [Math]::Min($innerSize / $image.Width, $innerSize / $image.Height)
        $scaledWidth = [int]($image.Width * $scale)
        $scaledHeight = [int]($image.Height * $scale)
        $x = ($Size - $scaledWidth) / 2
        $y = ($Size - $scaledHeight) / 2
        
        $graphics.DrawImage($image, $x, $y, $scaledWidth, $scaledHeight)
        
        # Draw border
        if ($BorderThickness -gt 0) {
            $graphics.ResetClip()
            $pen = New-Object System.Drawing.Pen($BorderColor, $BorderThickness)
            $pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
            $graphics.DrawEllipse($pen, $BorderThickness / 2, $BorderThickness / 2, $Size - $BorderThickness, $Size - $BorderThickness)
            $pen.Dispose()
        }
        
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()
        $path.Dispose()
        
        return $true
    } catch {
        Write-Host "Error creating circular foreground: $_" -ForegroundColor Red
        return $false
    }
}

# Function to create favicon (simplified, high contrast)
function Create-Favicon {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Size = 32
    )
    
    try {
        $image = [System.Drawing.Image]::FromFile($InputPath)
        $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # For favicon, use full size (no safe zone needed)
        $scale = [Math]::Min($Size / $image.Width, $Size / $image.Height)
        $scaledWidth = [int]($image.Width * $scale)
        $scaledHeight = [int]($image.Height * $scale)
        $x = ($Size - $scaledWidth) / 2
        $y = ($Size - $scaledHeight) / 2
        
        $graphics.DrawImage($image, $x, $y, $scaledWidth, $scaledHeight)
        
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()
        
        return $true
    } catch {
        Write-Host "Error creating favicon: $_" -ForegroundColor Red
        return $false
    }
}

# Icon sizes for different densities
$iconSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

# Create directories
$baseDir = "android\app\src\main\res"
foreach ($folder in $iconSizes.Keys) {
    $dir = Join-Path $baseDir $folder
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# Gold border color
$goldColor = [System.Drawing.Color]::FromArgb(255, 212, 175, 55)

Write-Host "=== Creating Icons ===" -ForegroundColor Cyan
Write-Host ""

# 1. Create adaptive icon backgrounds
Write-Host "1. Creating adaptive icon backgrounds..." -ForegroundColor Cyan
foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    $bgPath = Join-Path $baseDir "$folder\ic_launcher_background.png"
    if (Create-AdaptiveBackground -InputPath $backgroundIcon -OutputPath $bgPath -Size $size) {
        Write-Host "   ✓ $folder/ic_launcher_background.png" -ForegroundColor Green
    }
}
Write-Host ""

# 2. Create adaptive icon foregrounds
Write-Host "2. Creating adaptive icon foregrounds..." -ForegroundColor Cyan
foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    $fgPath = Join-Path $baseDir "$folder\ic_launcher_foreground.png"
    if (Create-AdaptiveForeground -InputPath $foregroundIcon -OutputPath $fgPath -Size $size) {
        Write-Host "   ✓ $folder/ic_launcher_foreground.png" -ForegroundColor Green
    }
}
Write-Host ""

# 3. Create main launcher icons (with gold border)
Write-Host "3. Creating main launcher icons (with gold border)..." -ForegroundColor Cyan
foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    $iconPath = Join-Path $baseDir "$folder\ic_launcher.png"
    $borderThickness = [Math]::Max(2, [int]($size * 0.02))
    
    if (Resize-Image-Enhanced -InputPath $mainIcon -OutputPath $iconPath -Width $size -Height $size -BorderColor $goldColor -BorderThickness $borderThickness) {
        Write-Host "   ✓ $folder/ic_launcher.png" -ForegroundColor Green
    }
}
Write-Host ""

# 4. Create round icons (circular with gold border)
Write-Host "4. Creating round icons..." -ForegroundColor Cyan
foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    $roundIconPath = Join-Path $baseDir "$folder\ic_launcher_round.png"
    $borderThickness = [Math]::Max(2, [int]($size * 0.02))
    
    if (Create-CircularForeground -InputPath $mainIcon -OutputPath $roundIconPath -Size $size -BorderColor $goldColor -BorderThickness $borderThickness) {
        Write-Host "   ✓ $folder/ic_launcher_round.png" -ForegroundColor Green
    }
}
Write-Host ""

# 5. Create Google Play Store icon (512x512)
Write-Host "5. Creating Google Play Store icon (512x512)..." -ForegroundColor Cyan
$playStoreIcon = Join-Path $baseDir "mipmap-xxxhdpi\ic_launcher_play_store.png"
$borderThickness = [Math]::Max(4, [int](512 * 0.02))
if (Resize-Image-Enhanced -InputPath $mainIcon -OutputPath $playStoreIcon -Width 512 -Height 512 -BorderColor $goldColor -BorderThickness $borderThickness) {
    Write-Host "   ✓ ic_launcher_play_store.png (512x512)" -ForegroundColor Green
}
Write-Host ""

# 6. Create favicons for web (Next.js App Router)
Write-Host "6. Creating favicons for web..." -ForegroundColor Cyan

# Next.js 13+ automatically detects these files in the app directory:
# - icon.png (32x32 or larger)
# - apple-icon.png (180x180 for Apple devices)
# - favicon.ico (traditional favicon)

if ($faviconSource) {
    # Create main icon.png (Next.js will use this as favicon)
    $iconPath = "app\icon.png"
    if (Create-Favicon -InputPath $faviconSource -OutputPath $iconPath -Size 32) {
        Write-Host "   ✓ icon.png (32x32 - Next.js favicon)" -ForegroundColor Green
    }
    
    # Create Apple touch icon (180x180)
    $appleIconPath = "app\apple-icon.png"
    if (Create-Favicon -InputPath $faviconSource -OutputPath $appleIconPath -Size 180) {
        Write-Host "   ✓ apple-icon.png (180x180 - Apple devices)" -ForegroundColor Green
    }
    
    # Create traditional favicon.ico (copy 32x32 as .ico)
    $favicon32Path = "app\favicon-32.png"
    if (Create-Favicon -InputPath $faviconSource -OutputPath $favicon32Path -Size 32) {
        Write-Host "   ✓ favicon-32.png (32x32)" -ForegroundColor Green
        # Copy as favicon.ico (Next.js will detect this)
        Copy-Item $favicon32Path "app\favicon.ico" -Force
        Write-Host "   ✓ favicon.ico (32x32)" -ForegroundColor Green
    }
    
    # Create additional sizes for better browser support
    $faviconSizes = @(16, 48, 64)
    foreach ($size in $faviconSizes) {
        $faviconPath = "app\favicon-$size.png"
        if (Create-Favicon -InputPath $faviconSource -OutputPath $faviconPath -Size $size) {
            Write-Host "   ✓ favicon-$size.png" -ForegroundColor Green
        }
    }
} else {
    Write-Host "   ⚠ No favicon source found, skipping web favicons" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== Icon Generation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✓ Adaptive icon backgrounds (all densities)" -ForegroundColor White
Write-Host "  ✓ Adaptive icon foregrounds (all densities)" -ForegroundColor White
Write-Host "  ✓ Main launcher icons with gold border (all densities)" -ForegroundColor White
Write-Host "  ✓ Round icons with gold border (all densities)" -ForegroundColor White
Write-Host "  ✓ Google Play Store icon (512x512)" -ForegroundColor White
Write-Host "  ✓ Web favicons (icon.png, apple-icon.png, favicon.ico)" -ForegroundColor White
Write-Host ""
Write-Host "Icons location:" -ForegroundColor Cyan
Write-Host "  Android: android\app\src\main\res\mipmap-*\" -ForegroundColor White
Write-Host "  Web: app\icon.png, app\apple-icon.png, app\favicon.ico" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review the generated icons" -ForegroundColor White
Write-Host "  2. Rebuild your APK/AAB to include new icons" -ForegroundColor White
Write-Host "  3. Next.js will automatically detect favicons in app/ directory" -ForegroundColor White
Write-Host "  4. Deploy to Vercel to see favicons on web" -ForegroundColor White
