# Create App Icons from Background Image
# This script creates all required Android app icon sizes with transparency preserved

Write-Host "=== Creating App Icons ===" -ForegroundColor Cyan
Write-Host ""

# Check for icon image files (in order of preference)
$possibleImages = @(
    "app-icon.png",
    "app-icon.jpg",
    "new-icon.png",
    "icon.png",
    "favicon.png",
    "money-plant-icon.png",
    "temp-background.jpg"
)

$sourceImage = $null
foreach ($img in $possibleImages) {
    if (Test-Path $img) {
        $sourceImage = $img
        break
    }
}

if (-not $sourceImage) {
    Write-Host "Error: No icon image found. Please save your icon as one of:" -ForegroundColor Red
    foreach ($img in $possibleImages) {
        Write-Host "  - $img" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host "Source image found: $sourceImage" -ForegroundColor Green
Write-Host ""

# Load System.Drawing for image processing
Add-Type -AssemblyName System.Drawing

# Function to resize image with high quality
function Resize-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height,
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
        
        # Create high-quality bitmap
        $bitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        # Set highest quality rendering for maximum sharpness
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        
        # Fill background with transparent
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # Draw image with padding for gold border
        $padding = [Math]::Max(2, $newWidth * 0.02) # 2% padding for border
        $graphics.DrawImage($image, $padding, $padding, $newWidth - ($padding * 2), $newHeight - ($padding * 2))
        
        # Draw yellowish gold border
        $goldColor = [System.Drawing.Color]::FromArgb(255, 212, 175, 55) # Gold color
        $pen = New-Object System.Drawing.Pen($goldColor, $padding * 2)
        $pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
        $graphics.DrawRectangle($pen, 0, 0, $newWidth - 1, $newHeight - 1)
        $pen.Dispose()
        
        # Save as PNG with transparency support
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

# Function to create circular mask for foreground
function Create-CircularForeground {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Size
    )
    
    try {
        $image = [System.Drawing.Image]::FromFile($InputPath)
        $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        # Highest quality for maximum sharpness
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # Fill background with transparent
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # Create circular path with padding for gold border
        $borderWidth = [Math]::Max(2, $Size * 0.02) # 2% border
        $innerSize = $Size - ($borderWidth * 2)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse($borderWidth, $borderWidth, $innerSize, $innerSize)
        $graphics.SetClip($path)
        
        # Draw image centered with padding
        $scale = [Math]::Min($innerSize / $image.Width, $innerSize / $image.Height)
        $scaledWidth = [int]($image.Width * $scale)
        $scaledHeight = [int]($image.Height * $scale)
        $x = ($Size - $scaledWidth) / 2
        $y = ($Size - $scaledHeight) / 2
        
        $graphics.DrawImage($image, $x, $y, $scaledWidth, $scaledHeight)
        
        # Reset clip and draw gold border
        $graphics.ResetClip()
        $goldColor = [System.Drawing.Color]::FromArgb(255, 212, 175, 55) # Gold color
        $pen = New-Object System.Drawing.Pen($goldColor, $borderWidth * 2)
        $pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
        $graphics.DrawEllipse($pen, $borderWidth / 2, $borderWidth / 2, $Size - $borderWidth, $Size - $borderWidth)
        $pen.Dispose()
        
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()
        
        return $true
    } catch {
        Write-Host "Error creating foreground: $_" -ForegroundColor Red
        return $false
    }
}

# Icon sizes for different densities (Android mipmap)
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

# Create Google Play Store icon (512x512)
Write-Host "Creating Google Play Store icon (512x512)..." -ForegroundColor Cyan
$playStoreIcon = "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_play_store.png"
if (Resize-Image -InputPath $sourceImage -OutputPath $playStoreIcon -Width 512 -Height 512) {
    Write-Host "Created: $playStoreIcon" -ForegroundColor Green
} else {
    Write-Host "Failed to create Play Store icon" -ForegroundColor Red
}

Write-Host ""

# Create icons for each density
Write-Host "Creating app icons for all densities..." -ForegroundColor Cyan
foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    $iconPath = Join-Path $baseDir "$folder\ic_launcher.png"
    $roundIconPath = Join-Path $baseDir "$folder\ic_launcher_round.png"
    $foregroundPath = Join-Path $baseDir "$folder\ic_launcher_foreground.png"
    
    Write-Host "Creating $folder icons..." -ForegroundColor Gray
    
    # Create main icon
    if (Resize-Image -InputPath $sourceImage -OutputPath $iconPath -Width $size -Height $size) {
        Write-Host "  ic_launcher.png" -ForegroundColor Green
    }
    
    # Create round icon (same as regular for now)
    if (Resize-Image -InputPath $sourceImage -OutputPath $roundIconPath -Width $size -Height $size) {
        Write-Host "  ic_launcher_round.png" -ForegroundColor Green
    }
    
    # Create foreground for adaptive icon (circular mask)
    if (Create-CircularForeground -InputPath $sourceImage -OutputPath $foregroundPath -Size $size) {
        Write-Host "  ic_launcher_foreground.png" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Icon Creation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Icons created in:" -ForegroundColor Cyan
Write-Host "  android\app\src\main\res\mipmap-*\" -ForegroundColor White
Write-Host ""
Write-Host "Google Play Store icon:" -ForegroundColor Cyan
Write-Host "  android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_play_store.png (512x512)" -ForegroundColor White
