# Create App Icons from Background Image - Enhanced Version
# High resolution with gold border

Write-Host "=== Creating Enhanced App Icons (High Resolution + Gold Border) ===" -ForegroundColor Cyan
Write-Host ""

# Check for icon image files
$possibleImages = @("app-icon-main.png", "app-icon.jpg", "new-icon.png", "icon.png", "favicon.png", "money-plant-icon.png", "temp-background.jpg")
$sourceImage = $null
foreach ($img in $possibleImages) {
    if (Test-Path $img) {
        $sourceImage = $img
        break
    }
}

if (-not $sourceImage) {
    Write-Host "Error: No icon image found. Please save your icon as app-icon-main.png" -ForegroundColor Red
    exit 1
}

Write-Host "Source image found: $sourceImage" -ForegroundColor Green
Write-Host ""

# Load System.Drawing for image processing
Add-Type -AssemblyName System.Drawing

# Function to resize image with maximum quality and gold border
function Resize-Image-Enhanced {
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
        
        # Create high-quality bitmap with transparency
        $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        # Set maximum quality rendering for sharpness
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        
        # Fill with transparent background
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # Calculate padding for gold border (2-3% of size)
        $borderPadding = [Math]::Max(2, [Math]::Min($Width * 0.03, 8))
        
        # Center the image with padding
        $imgX = ($Width - $newWidth) / 2
        $imgY = ($Height - $newHeight) / 2
        
        # Draw image with padding
        $imgXFinal = $imgX + $borderPadding
        $imgYFinal = $imgY + $borderPadding
        $imgWidthFinal = $newWidth - ($borderPadding * 2)
        $imgHeightFinal = $newHeight - ($borderPadding * 2)
        $graphics.DrawImage($image, $imgXFinal, $imgYFinal, $imgWidthFinal, $imgHeightFinal)
        
        # Draw yellowish gold border
        $goldColor = [System.Drawing.Color]::FromArgb(255, 212, 175, 55) # Gold: RGB(212, 175, 55)
        $penWidth = [Math]::Max(2, $borderPadding * 2)
        $pen = New-Object System.Drawing.Pen($goldColor, $penWidth)
        $pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $borderX = $penWidth / 2
        $borderY = $penWidth / 2
        $borderW = $Width - $penWidth
        $borderH = $Height - $penWidth
        $graphics.DrawRectangle($pen, $borderX, $borderY, $borderW, $borderH)
        $pen.Dispose()
        
        # Save as PNG with maximum quality
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 100L)
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/png" }
        $bitmap.Save($OutputPath, $codec, $encoderParams)
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()
        
        return $true
    } catch {
        Write-Host "Error processing image: $_" -ForegroundColor Red
        return $false
    }
}

# Function to create circular foreground with gold border
function Create-CircularForeground-Enhanced {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Size
    )
    
    try {
        $image = [System.Drawing.Image]::FromFile($InputPath)
        $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        # Maximum quality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # Fill with transparent
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        # Border width
        $borderWidth = [Math]::Max(2, [Math]::Min($Size * 0.03, 8))
        $innerSize = $Size - ($borderWidth * 2)
        
        # Create circular path
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse($borderWidth, $borderWidth, $innerSize, $innerSize)
        $graphics.SetClip($path)
        
        # Draw image centered
        $scale = [Math]::Min($innerSize / $image.Width, $innerSize / $image.Height)
        $scaledWidth = [int]($image.Width * $scale)
        $scaledHeight = [int]($image.Height * $scale)
        $x = ($Size - $scaledWidth) / 2
        $y = ($Size - $scaledHeight) / 2
        
        $graphics.DrawImage($image, $x, $y, $scaledWidth, $scaledHeight)
        
        # Reset clip and draw gold border
        $graphics.ResetClip()
        $goldColor = [System.Drawing.Color]::FromArgb(255, 212, 175, 55)
        $penWidth = [Math]::Max(2, $borderWidth * 2)
        $pen = New-Object System.Drawing.Pen($goldColor, $penWidth)
        $pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $ellipseX = $penWidth / 2
        $ellipseY = $penWidth / 2
        $ellipseSize = $Size - $penWidth
        $graphics.DrawEllipse($pen, $ellipseX, $ellipseY, $ellipseSize, $ellipseSize)
        $pen.Dispose()
        
        # Save with maximum quality
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 100L)
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/png" }
        $bitmap.Save($OutputPath, $codec, $encoderParams)
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()
        
        return $true
    } catch {
        Write-Host "Error creating foreground: $_" -ForegroundColor Red
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

# Create Google Play Store icon (512x512) with maximum quality
Write-Host "Creating Google Play Store icon (512x512) with gold border..." -ForegroundColor Cyan
$playStoreIcon = "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_play_store.png"
if (Resize-Image-Enhanced -InputPath $sourceImage -OutputPath $playStoreIcon -Width 512 -Height 512) {
    Write-Host "Created: $playStoreIcon" -ForegroundColor Green
} else {
    Write-Host "Failed to create Play Store icon" -ForegroundColor Red
}

Write-Host ""

# Create icons for each density
Write-Host "Creating enhanced app icons for all densities..." -ForegroundColor Cyan
foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    $iconPath = Join-Path $baseDir "$folder\ic_launcher.png"
    $roundIconPath = Join-Path $baseDir "$folder\ic_launcher_round.png"
    $foregroundPath = Join-Path $baseDir "$folder\ic_launcher_foreground.png"
    
    Write-Host "Creating $folder icons..." -ForegroundColor Gray
    
    # Create main icon
    if (Resize-Image-Enhanced -InputPath $sourceImage -OutputPath $iconPath -Width $size -Height $size) {
        Write-Host "  ic_launcher.png" -ForegroundColor Green
    }
    
    # Create round icon (same as regular)
    if (Resize-Image-Enhanced -InputPath $sourceImage -OutputPath $roundIconPath -Width $size -Height $size) {
        Write-Host "  ic_launcher_round.png" -ForegroundColor Green
    }
    
    # Create foreground for adaptive icon (circular with gold border)
    if (Create-CircularForeground-Enhanced -InputPath $sourceImage -OutputPath $foregroundPath -Size $size) {
        Write-Host "  ic_launcher_foreground.png" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Enhanced Icon Creation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Features:" -ForegroundColor Cyan
Write-Host "  ✓ Maximum resolution and sharpness" -ForegroundColor White
Write-Host "  ✓ Yellowish gold border (RGB 212, 175, 55)" -ForegroundColor White
Write-Host "  ✓ High-quality PNG format" -ForegroundColor White
Write-Host "  ✓ All density sizes created" -ForegroundColor White
