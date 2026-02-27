# Build Single Community APK
# Usage: .\build-single-flavor.ps1 kakira
# Usage: .\build-single-flavor.ps1 kyagalanyi
# Usage: .\build-single-flavor.ps1 defaultCommunity

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("defaultCommunity", "kakira", "kyagalanyi")]
    [string]$Flavor,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release")]
    [string]$BuildType = "release"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Building $Flavor APK ($BuildType)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if keystore.properties exists for release builds
if ($BuildType -eq "release") {
    $keystoreProps = Join-Path $PSScriptRoot "keystore.properties"
    if (-not (Test-Path $keystoreProps)) {
        Write-Host "WARNING: keystore.properties not found!" -ForegroundColor Yellow
        Write-Host "Release build will not be signed." -ForegroundColor Yellow
        Write-Host ""
    }
}

# Navigate to android directory
Push-Location $PSScriptRoot

try {
    # Capitalize build type for Gradle task
    $buildTypeCapitalized = (Get-Culture).TextInfo.ToTitleCase($BuildType)
    $flavorCapitalized = (Get-Culture).TextInfo.ToTitleCase($Flavor)
    
    $taskName = "assemble$flavorCapitalized$buildTypeCapitalized"
    
    Write-Host "Running Gradle task: $taskName" -ForegroundColor Green
    Write-Host ""
    
    & .\gradlew.bat $taskName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host "Build Successful!" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host ""
        
        # Find and display the built APK
        $apkPath = "app\build\outputs\apk\$Flavor\$BuildType"
        
        if (Test-Path $apkPath) {
            Write-Host "Output APK:" -ForegroundColor Cyan
            Get-ChildItem -Path $apkPath -Filter "*.apk" | ForEach-Object {
                $size = [math]::Round($_.Length / 1MB, 2)
                Write-Host "  - $($_.FullName)" -ForegroundColor White
                Write-Host "    Size: $size MB" -ForegroundColor Gray
            }
            Write-Host ""
        }
    } else {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Red
        Write-Host "Build Failed!" -ForegroundColor Red
        Write-Host "=====================================" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
