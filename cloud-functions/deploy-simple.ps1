# Simple deployment script for FCM Cloud Function
$functionName = "sendFCMNotification"
$region = "us-central1"
$runtime = "nodejs20"

Write-Host "=== FCM Cloud Function Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Check service account file
$serviceAccountPath = "..\android\farm2market-uganda-firebase-adminsdk-fbsvc-4460e91020.json"
if (-not (Test-Path $serviceAccountPath)) {
    Write-Host "Service account JSON not found" -ForegroundColor Red
    exit 1
}

Write-Host "Service account JSON found" -ForegroundColor Green
Write-Host ""

# Create env vars file
Write-Host "Preparing environment variables..." -ForegroundColor Cyan
$json = Get-Content $serviceAccountPath -Raw
$jsonEscaped = $json -replace '"', '\"'
"FCM_SERVICE_ACCOUNT: `"$jsonEscaped`"" | Out-File -FilePath "env-vars.yaml" -Encoding utf8

Write-Host "Deploying Cloud Function..." -ForegroundColor Cyan
Write-Host "Function: $functionName" -ForegroundColor Gray
Write-Host "Region: $region" -ForegroundColor Gray
Write-Host "Runtime: $runtime" -ForegroundColor Gray
Write-Host "This may take 2-5 minutes..." -ForegroundColor Gray
Write-Host ""

# Deploy
gcloud functions deploy $functionName --gen2 --runtime=$runtime --region=$region --source=./fcm-sender --entry-point=sendFCMNotification --trigger-http --allow-unauthenticated --env-vars-file=env-vars.yaml --memory=256MB --timeout=60s

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
    Write-Host ""
    
    # Get function URL
    Write-Host "Getting function URL..." -ForegroundColor Cyan
    $functionUrl = gcloud functions describe $functionName --gen2 --region=$region --format="value(serviceConfig.uri)" 2>&1
    
    if ($functionUrl -and -not $functionUrl.StartsWith("ERROR")) {
        Write-Host ""
        Write-Host "Function URL: $functionUrl" -ForegroundColor Green
        Write-Host ""
        
        # Set in Convex
        Write-Host "Setting URL in Convex..." -ForegroundColor Cyan
        npx convex env set FCM_CLOUD_FUNCTION_URL "$functionUrl"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "URL set in Convex!" -ForegroundColor Green
        } else {
            Write-Host "Run manually: npx convex env set FCM_CLOUD_FUNCTION_URL $functionUrl" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "=== Setup Complete! ===" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "Deployment failed" -ForegroundColor Red
    Write-Host "Check the error above" -ForegroundColor Red
}
