# Complete setup and deployment script for FCM Cloud Function
# This script will guide you through authentication and deployment

$functionName = "sendFCMNotification"
$region = "us-central1"
$runtime = "nodejs20"

Write-Host "=== FCM Cloud Function Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "✓ Google Cloud CLI found: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Google Cloud CLI not found" -ForegroundColor Red
    Write-Host "  Please install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Set project
Write-Host "Setting project to farm2market-uganda..." -ForegroundColor Cyan
gcloud config set project farm2market-uganda 2>&1 | Out-Null
Write-Host "✓ Project set" -ForegroundColor Green
Write-Host ""

# Check authentication
Write-Host "Checking authentication..." -ForegroundColor Cyan
$currentAccount = gcloud config get-value account 2>&1
if ($currentAccount -match "service_account") {
    Write-Host "⚠ Currently using service account: $currentAccount" -ForegroundColor Yellow
    Write-Host "  Service accounts cannot enable APIs. Switching to user authentication..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please authenticate with your Google account (this will open a browser):" -ForegroundColor Cyan
    gcloud auth login
    Write-Host ""
}

# Enable required APIs (requires user account with permissions)
Write-Host "Enabling required APIs..." -ForegroundColor Cyan
gcloud services enable cloudfunctions.googleapis.com --quiet 2>&1 | Out-Null
gcloud services enable cloudbuild.googleapis.com --quiet 2>&1 | Out-Null
gcloud services enable run.googleapis.com --quiet 2>&1 | Out-Null
Write-Host "✓ APIs enabled (or already enabled)" -ForegroundColor Green
Write-Host ""

# Check service account file
$serviceAccountPath = "..\android\farm2market-uganda-firebase-adminsdk-fbsvc-4460e91020.json"
if (-not (Test-Path $serviceAccountPath)) {
    Write-Host "✗ Service account JSON not found at $serviceAccountPath" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Service account JSON found" -ForegroundColor Green
Write-Host ""

Write-Host "Deploying Cloud Function..." -ForegroundColor Cyan
Write-Host "  Function: $functionName" -ForegroundColor Gray
Write-Host "  Region: $region" -ForegroundColor Gray
Write-Host "  Runtime: $runtime" -ForegroundColor Gray
Write-Host "  This may take 2-5 minutes..." -ForegroundColor Gray
Write-Host ""

# Read service account JSON and prepare for environment variable
$serviceAccountContent = Get-Content $serviceAccountPath -Raw
# Convert to single-line JSON string for environment variable
$serviceAccountJson = $serviceAccountContent | ConvertFrom-Json | ConvertTo-Json -Compress
# Escape quotes for shell
$serviceAccountEscaped = $serviceAccountJson -replace '"', '\"'

# Deploy the function
try {
    $deployCmd = "gcloud functions deploy $functionName --gen2 --runtime=$runtime --region=$region --source=./fcm-sender --entry-point=sendFCMNotification --trigger-http --allow-unauthenticated --set-env-vars=`"FCM_SERVICE_ACCOUNT=$serviceAccountEscaped`" --memory=256MB --timeout=60s"
    Invoke-Expression $deployCmd
    
    Write-Host ""
    Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
    Write-Host ""
    
    # Get the function URL
    Write-Host "Getting function URL..." -ForegroundColor Cyan
    $functionUrl = gcloud functions describe $functionName --gen2 --region=$region --format="value(serviceConfig.uri)" 2>&1
    
    if ($functionUrl -and -not $functionUrl.StartsWith("ERROR")) {
        Write-Host ""
        Write-Host "✓ Function URL:" -ForegroundColor Green
        Write-Host "  $functionUrl" -ForegroundColor Yellow
        Write-Host ""
        
        # Set in Convex
        Write-Host "Setting URL in Convex..." -ForegroundColor Cyan
        $convexResult = npx convex env set FCM_CLOUD_FUNCTION_URL "$functionUrl" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ URL set in Convex!" -ForegroundColor Green
        } else {
            Write-Host "⚠ Could not set URL in Convex automatically" -ForegroundColor Yellow
            Write-Host "  Please run manually:" -ForegroundColor Yellow
            Write-Host "  npx convex env set FCM_CLOUD_FUNCTION_URL `"$functionUrl`"" -ForegroundColor White
        }
        Write-Host ""
        Write-Host "=== Setup Complete! ===" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Make sure google-services.json is in android/app/" -ForegroundColor White
        Write-Host "2. Rebuild your APK" -ForegroundColor White
        Write-Host "3. Test push notifications!" -ForegroundColor White
        
    } else {
        Write-Host "⚠ Could not retrieve function URL automatically" -ForegroundColor Yellow
        Write-Host "  Check the deployment output above or run:" -ForegroundColor Yellow
        Write-Host "  gcloud functions describe $functionName --gen2 --region=$region --format='value(serviceConfig.uri)'" -ForegroundColor White
    }
    
} catch {
    Write-Host ""
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure you're authenticated: gcloud auth login" -ForegroundColor White
    Write-Host "2. Check billing is enabled for your project" -ForegroundColor White
    Write-Host "3. Verify the service account file exists" -ForegroundColor White
    exit 1
}
