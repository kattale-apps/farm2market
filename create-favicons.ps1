# Create Web Favicons
Add-Type -AssemblyName System.Drawing

Write-Host "Creating web favicons..." -ForegroundColor Cyan

if (Test-Path "favicon-source.png") {
    $source = "favicon-source.png"
} else {
    $source = "app-icon-main.png"
}

$sizes = @(16, 32, 48, 64, 180)

foreach ($s in $sizes) {
    $img = [System.Drawing.Image]::FromFile($source)
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $scale = [Math]::Min($s / $img.Width, $s / $img.Height)
    $w = [int]($img.Width * $scale)
    $h = [int]($img.Height * $scale)
    $x = ($s - $w) / 2
    $y = ($s - $h) / 2
    
    $g.DrawImage($img, $x, $y, $w, $h)
    
    if ($s -eq 32) {
        $bmp.Save("app\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Save("app\favicon.ico", [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "  ✓ icon.png" -ForegroundColor Green
        Write-Host "  ✓ favicon.ico" -ForegroundColor Green
    } elseif ($s -eq 180) {
        $bmp.Save("app\apple-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "  ✓ apple-icon.png" -ForegroundColor Green
    } else {
        $bmp.Save("app\favicon-$s.png", [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "  ✓ favicon-$s.png" -ForegroundColor Green
    }
    
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

Write-Host ""
Write-Host "Favicons created successfully!" -ForegroundColor Green
