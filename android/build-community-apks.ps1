# Build Community-Specific APKs
# This script builds release APKs for all community flavors

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Building Community-Specific APKs" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if keystore.properties exists
$keystoreProps = Join-Path $PSScriptRoot "keystore.properties"
if (-not (Test-Path $keystoreProps)) {
    Write-Host "WARNING: keystore.properties not found!" -ForegroundColor Yellow
    Write-Host "Release builds will not be signed." -ForegroundColor Yellow
    Write-Host "See CREATE_KEYSTORE_MANUAL.md for setup instructions." -ForegroundColor Yellow
    Write-Host ""
}

# Navigate to android directory
Push-Location $PSScriptRoot

try {
    Write-Host "Building all release APKs..." -ForegroundColor Green
    Write-Host ""
    
    # Build all flavors at once
    & .\gradlew.bat assembleRelease
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host "Build Successful!" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Output APKs:" -ForegroundColor Cyan
        Write-Host ""
        
        $apkDir = "app\build\outputs\apk"
        
        # List all generated APKs
        Get-ChildItem -Path $apkDir -Recurse -Filter "*.apk" | ForEach-Object {
            $size = [math]::Round($_.Length / 1MB, 2)
            Write-Host "  - $($_.FullName)" -ForegroundColor White
            Write-Host "    Size: $size MB" -ForegroundColor Gray
            Write-Host ""
        }
        
        Write-Host "Flavor Details:" -ForegroundColor Cyan
        Write-Host "  defaultCommunity: com.farm2marketuganda.app (FarmCoin)" -ForegroundColor White
        Write-Host "  kakira: com.farm2marketuganda.app.kakira (Kakira Farmers)" -ForegroundColor White
        Write-Host "  kyagalanyi: com.farm2marketuganda.app.kyagalanyi (Kyagalanyi Farmers)" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Red
        Write-Host "Build Failed!" -ForegroundColor Red
        Write-Host "=====================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Check the error messages above for details." -ForegroundColor Yellow
        exit 1
    }
} finally {
    Pop-Location
}
