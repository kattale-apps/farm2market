# Create Google Play Store Feature Graphic (1024x500)
# This is the banner image shown on your Play Store listing

Write-Host "=== Creating Feature Graphic ===" -ForegroundColor Cyan
Write-Host ""

# Check for icon image files
$possibleImages = @("app-icon.png", "app-icon.jpg", "new-icon.png", "icon.png", "temp-background.jpg")
$sourceImage = $null
foreach ($img in $possibleImages) {
    if (Test-Path $img) {
        $sourceImage = $img
        break
    }
}

if (-not $sourceImage) {
    Write-Host "Error: No icon image found. Please save your icon as app-icon.png" -ForegroundColor Red
    exit 1
}

Add-Type -AssemblyName System.Drawing

try {
    $image = [System.Drawing.Image]::FromFile($sourceImage)
    $bitmap = New-Object System.Drawing.Bitmap(1024, 500, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # High quality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Draw image to fill 1024x500 (will crop to fit)
    $graphics.DrawImage($image, 0, 0, 1024, 500)
    
    $outputPath = "google-play-feature-graphic.png"
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
    $image.Dispose()
    
    Write-Host "Created: $outputPath (1024x500)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Upload this to Google Play Console:" -ForegroundColor Cyan
    Write-Host "  Store listing -> Graphics -> Feature graphic" -ForegroundColor White
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
