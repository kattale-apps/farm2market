# Firebase Setup Helper Script
# This script helps verify Firebase configuration

Write-Host "=== Firebase Configuration Check ===" -ForegroundColor Cyan
Write-Host ""

# Check if google-services.json exists
$googleServicesPath = "android\app\google-services.json"
if (Test-Path $googleServicesPath) {
    Write-Host "✓ google-services.json found" -ForegroundColor Green
    $json = Get-Content $googleServicesPath | ConvertFrom-Json
    Write-Host "  Project ID: $($json.project_info.project_id)" -ForegroundColor Gray
    Write-Host "  Project Number: $($json.project_info.project_number)" -ForegroundColor Gray
} else {
    Write-Host "✗ google-services.json NOT found" -ForegroundColor Red
    Write-Host "  Expected location: $googleServicesPath" -ForegroundColor Yellow
    Write-Host "  Please download from Firebase Console and place it there" -ForegroundColor Yellow
}

Write-Host ""

# Check Convex environment variables
Write-Host "Checking Convex environment variables..." -ForegroundColor Cyan
try {
    $envVars = npx convex env list 2>&1
    if ($envVars -match "FCM_SERVER_KEY") {
        Write-Host "✓ FCM_SERVER_KEY is set in Convex" -ForegroundColor Green
    } else {
        Write-Host "✗ FCM_SERVER_KEY is NOT set in Convex" -ForegroundColor Red
        Write-Host "  Run: npx convex env set FCM_SERVER_KEY `"your-key-here`"" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not check Convex environment variables" -ForegroundColor Yellow
    Write-Host "  Make sure you're logged into Convex" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Create Firebase project at https://console.firebase.google.com/" -ForegroundColor White
Write-Host "2. Add Android app with package: com.farm2market.uganda" -ForegroundColor White
Write-Host "3. Download google-services.json to android/app/" -ForegroundColor White
Write-Host "4. Get FCM Server key from Firebase Console" -ForegroundColor White
Write-Host "5. Set FCM_SERVER_KEY in Convex: npx convex env set FCM_SERVER_KEY `"key`"" -ForegroundColor White
Write-Host "6. Rebuild APK: cd android && .\gradlew.bat assembleDebug" -ForegroundColor White
Write-Host ""
Write-Host "See FIREBASE_SETUP_INSTRUCTIONS.md for detailed steps" -ForegroundColor Cyan
