# Build Production APKs (FarmCoin - www.farm2marketuganda.com)

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("defaultCommunity", "kakira", "kyagalanyi", "all")]
    [string]$Flavor = "all",

    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release")]
    [string]$BuildType = "release"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Building PRODUCTION APKs (FarmCoin)" -ForegroundColor Cyan
Write-Host "Server: https://www.farm2marketuganda.com" -ForegroundColor Green
Write-Host "Convex: greedy-tortoise-911.convex.cloud" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan

Push-Location $PSScriptRoot

try {
    # Bake the production server URL into android/app/src/main/assets/capacitor.config.json.
    # Without this, the APK silently keeps whatever server.url was last synced (e.g. a dev URL)
    # regardless of which Gradle flavor/BuildConfig.SERVER_URL is selected.
    Write-Host "Syncing Capacitor config for production server..." -ForegroundColor Yellow
    Push-Location (Join-Path $PSScriptRoot "..")
    try {
        $env:CAPACITOR_SERVER_URL = "https://www.farm2marketuganda.com"
        & npx cap copy android
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Capacitor sync failed!" -ForegroundColor Red
            exit 1
        }
    } finally {
        Remove-Item Env:\CAPACITOR_SERVER_URL -ErrorAction SilentlyContinue
        Pop-Location
    }

    # Use Substring-based capitalization (not ToTitleCase, which lowercases the
    # rest of camelCase words like "defaultCommunity" -> "Defaultcommunity").
    function Capitalize([string]$s) { $s.Substring(0,1).ToUpper() + $s.Substring(1) }

    $buildTypeCapitalized = Capitalize $BuildType

    if ($Flavor -eq "all") {
        $communities = @("defaultCommunity", "kakira", "kyagalanyi")
    } else {
        $communities = @($Flavor)
    }

    # Gradle flavor dimensions are declared as "community", "deployment", so
    # assemble task names combine community + deployment + build type, in that order.
    $tasks = @($communities | ForEach-Object {
        "assemble$(Capitalize $_)ProductionFlavors${buildTypeCapitalized}"
    })

    Write-Host "Running: $($tasks -join ' ')" -ForegroundColor Yellow
    & .\gradlew.bat $tasks

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Build Successful!" -ForegroundColor Green
        Get-ChildItem -Path "app\build\outputs\apk" -Recurse -Filter "app-*-release.apk" | Where-Object { $_.FullName -notlike "*f2m*" } | ForEach-Object {
            $size = [math]::Round($_.Length / 1MB, 2)
            Write-Host "-> $($_.Name) [$size MB]" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Build Failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
