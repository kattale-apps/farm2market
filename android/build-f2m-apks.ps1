# Build F2M APKs (Farmers to Market - Internal Testing)

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("defaultCommunity", "kakira", "kyagalanyi", "all")]
    [string]$Flavor = "all",

    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release")]
    [string]$BuildType = "debug"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Building F2M APKs (Internal Testing)" -ForegroundColor Cyan
Write-Host "Server: https://farm2market-dev.vercel.app" -ForegroundColor Yellow
Write-Host "Convex: adamant-armadillo-601.convex.cloud" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan

Push-Location $PSScriptRoot

try {
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
        "assemble$(Capitalize $_)F2mFlavors${buildTypeCapitalized}"
    })

    Write-Host "Running: $($tasks -join ' ')" -ForegroundColor Yellow
    & .\gradlew.bat $tasks

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Build Successful!" -ForegroundColor Green
        Get-ChildItem -Path "app\build\outputs\apk" -Recurse -Filter "*f2m*.apk" | ForEach-Object {
            $size = [math]::Round($_.Length / 1MB, 2)
            Write-Host "🧪 $($_.Name) [$size MB]" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Build Failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
