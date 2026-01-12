# Create Release Keystore for Google Play Store
# Run this script ONCE to create your signing key

Write-Host "=== Creating Release Keystore ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will create a keystore file for signing your release builds." -ForegroundColor Yellow
Write-Host "IMPORTANT: Save the passwords securely - you'll need them for all future updates!" -ForegroundColor Red
Write-Host ""

$keystorePath = "app\farm2market-release.keystore"
$alias = "farm2market"

# Check if keystore already exists
if (Test-Path $keystorePath) {
    Write-Host "WARNING: Keystore already exists at $keystorePath" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (yes/no)"
    if ($overwrite -ne "yes") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Enter keystore details:" -ForegroundColor Cyan
$storePassword = Read-Host "Keystore Password" -AsSecureString
$storePasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePassword))

$keyPassword = Read-Host "Key Password (can be same as keystore)" -AsSecureString
$keyPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPassword))

Write-Host ""
Write-Host "Enter certificate information:" -ForegroundColor Cyan
$name = Read-Host "Your Name" 
$org = Read-Host "Organization (e.g., Farm2Market Uganda)"
$city = Read-Host "City"
$state = Read-Host "State/Province"
$country = Read-Host "Country Code (2 letters, e.g., UG)"

Write-Host ""
Write-Host "Creating keystore..." -ForegroundColor Cyan

# Find keytool
$keytool = $null
if ($env:JAVA_HOME) {
    $keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
    if (-not (Test-Path $keytool)) {
        $keytool = $null
    }
}

if (-not $keytool) {
    $keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
    if (-not (Test-Path $keytool)) {
        Write-Host "Error: keytool not found. Please set JAVA_HOME or install Java JDK." -ForegroundColor Red
        Write-Host "Tried: $env:JAVA_HOME\bin\keytool.exe" -ForegroundColor Yellow
        Write-Host "Tried: C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -ForegroundColor Yellow
        exit 1
    }
}

$dname = "CN=$name, OU=$org, O=$org, L=$city, ST=$state, C=$country"

& $keytool -genkey -v -keystore $keystorePath -alias $alias -keyalg RSA -keysize 2048 -validity 10000 -storepass $storePasswordPlain -keypass $keyPasswordPlain -dname $dname

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Keystore Created Successfully! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Keystore location: $keystorePath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Now create keystore.properties file with:" -ForegroundColor Yellow
    Write-Host "storePassword=$storePasswordPlain" -ForegroundColor White
    Write-Host "keyPassword=$keyPasswordPlain" -ForegroundColor White
    Write-Host "keyAlias=$alias" -ForegroundColor White
    Write-Host "storeFile=app/farm2market-release.keystore" -ForegroundColor White
    Write-Host ""
    Write-Host "IMPORTANT: Save these passwords securely!" -ForegroundColor Red
    Write-Host "You'll need them for all future app updates!" -ForegroundColor Red
} else {
    Write-Host "Error creating keystore." -ForegroundColor Red
    exit 1
}
