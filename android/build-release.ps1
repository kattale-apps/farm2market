# Build Release AAB for Google Play Store

Write-Host "=== Building Release AAB ===" -ForegroundColor Cyan
Write-Host ""

# Check keystore exists
$keystorePath = "app\farm2market-release.keystore"
if (-not (Test-Path $keystorePath)) {
    Write-Host "Error: Keystore not found at $keystorePath" -ForegroundColor Red
    Write-Host "Run create-keystore.ps1 first!" -ForegroundColor Yellow
    exit 1
}

# Check keystore.properties exists
if (-not (Test-Path "keystore.properties")) {
    Write-Host "Error: keystore.properties not found!" -ForegroundColor Red
    Write-Host "Create keystore.properties with your keystore details." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Example keystore.properties:" -ForegroundColor Cyan
    Write-Host "storePassword=YOUR_KEYSTORE_PASSWORD" -ForegroundColor White
    Write-Host "keyPassword=YOUR_KEY_PASSWORD" -ForegroundColor White
    Write-Host "keyAlias=farm2market" -ForegroundColor White
    Write-Host "storeFile=app/farm2market-release.keystore" -ForegroundColor White
    exit 1
}

# Set JAVA_HOME
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path $env:JAVA_HOME)) {
    Write-Host "Warning: JAVA_HOME not found at default location" -ForegroundColor Yellow
    Write-Host "Trying to find Java..." -ForegroundColor Yellow
    # Try to find Java
    $javaPaths = @(
        "C:\Program Files\Java\jdk*",
        "C:\Program Files\Android\Android Studio\jbr"
    )
    $found = $false
    foreach ($path in $javaPaths) {
        $jdk = Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($jdk) {
            $env:JAVA_HOME = $jdk.FullName
            $found = $true
            break
        }
    }
    if (-not $found) {
        Write-Host "Error: JAVA_HOME not set correctly" -ForegroundColor Red
        Write-Host "Please set JAVA_HOME environment variable" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Gray
Write-Host ""
Write-Host "Building release AAB..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

.\gradlew.bat bundleRelease

if ($LASTEXITCODE -eq 0) {
    $aabPath = "app\build\outputs\bundle\release\app-release.aab"
    if (Test-Path $aabPath) {
        $aab = Get-Item $aabPath
        Write-Host ""
        Write-Host "=== Build Successful! ===" -ForegroundColor Green
        Write-Host ""
        Write-Host "AAB Location: $($aab.FullName)" -ForegroundColor Cyan
        Write-Host "Size: $([math]::Round($aab.Length/1MB, 2)) MB" -ForegroundColor Cyan
        Write-Host "Created: $($aab.LastWriteTime)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Ready to upload to Google Play Console!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Go to Google Play Console: https://play.google.com/console" -ForegroundColor White
        Write-Host "2. Create new app or select existing app" -ForegroundColor White
        Write-Host "3. Go to Production -> Create new release" -ForegroundColor White
        Write-Host "4. Upload this AAB file" -ForegroundColor White
    } else {
        Write-Host "Error: AAB file not found at expected location" -ForegroundColor Red
        Write-Host "Expected: $aabPath" -ForegroundColor Yellow
    }
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
