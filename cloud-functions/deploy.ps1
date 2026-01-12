# Deploy FCM Sender Cloud Function
# Make sure you have gcloud CLI installed and authenticated

$functionName = "sendFCMNotification"
$region = "us-central1"  # Change to your preferred region
$runtime = "nodejs20"    # Or nodejs18, nodejs16

Write-Host "=== Deploying FCM Sender Cloud Function ===" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud --version 2>&1
    Write-Host "✓ Google Cloud CLI found" -ForegroundColor Green
} catch {
    Write-Host "✗ Google Cloud CLI not found" -ForegroundColor Red
    Write-Host "  Please install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Check if service account file exists
$serviceAccountPath = "..\android\farm2market-uganda-firebase-adminsdk-fbsvc-4460e91020.json"
if (-not (Test-Path $serviceAccountPath)) {
    Write-Host "✗ Service account JSON not found at $serviceAccountPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Service account JSON found" -ForegroundColor Green
Write-Host ""

# Read service account JSON
$serviceAccount = Get-Content $serviceAccountPath -Raw

# Escape the JSON for environment variable (replace newlines and quotes)
$serviceAccountEscaped = $serviceAccount -replace "`"", "\`"" -replace "`r`n", "`n"

Write-Host "Enabling required APIs..." -ForegroundColor Cyan
gcloud services enable cloudfunctions.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
Write-Host "✓ APIs enabled" -ForegroundColor Green
Write-Host ""

Write-Host "Deploying Cloud Function..." -ForegroundColor Cyan
Write-Host "Function: $functionName" -ForegroundColor Gray
Write-Host "Region: $region" -ForegroundColor Gray
Write-Host "Runtime: $runtime" -ForegroundColor Gray
Write-Host ""

# Deploy the function
try {
    gcloud functions deploy $functionName `
        --gen2 `
        --runtime=$runtime `
        --region=$region `
        --source=./fcm-sender `
        --entry-point=sendFCMNotification `
        --trigger-http `
        --allow-unauthenticated `
        --set-env-vars="FCM_SERVICE_ACCOUNT=$serviceAccountEscaped" `
        --memory=256MB `
        --timeout=60s `
        --quiet
    
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
        Write-Host "Next step: Set this URL in Convex:" -ForegroundColor Cyan
        Write-Host "  npx convex env set FCM_CLOUD_FUNCTION_URL `"$functionUrl`"" -ForegroundColor White
        Write-Host ""
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
    Write-Host "2. Set the project: gcloud config set project farm2market-uganda" -ForegroundColor White
    Write-Host "3. Check billing is enabled for your project" -ForegroundColor White
    exit 1
}
