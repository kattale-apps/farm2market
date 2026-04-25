$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) {
  $pipelineInput = @($input) -join "`n"
  if (-not [string]::IsNullOrWhiteSpace($pipelineInput)) {
    $inputJson = $pipelineInput
  }
}

if ([string]::IsNullOrWhiteSpace($inputJson)) {
  exit 0
}

try {
  $payload = $inputJson | ConvertFrom-Json -Depth 20
} catch {
  exit 0
}

$toolName = $payload.toolName
if ($toolName -ne "run_in_terminal") {
  exit 0
}

$command = ""
if ($payload.toolInput -and $payload.toolInput.command) {
  $command = [string]$payload.toolInput.command
}

if ([string]::IsNullOrWhiteSpace($command)) {
  exit 0
}

$normalized = $command.ToLowerInvariant()
$containsConvex = $normalized -match "(^|\s)(npx\s+)?convex(\s|$)"
if (-not $containsConvex) {
  exit 0
}

$isProdDeploy = $normalized -match "convex\s+deploy"
$isDevDeploy = $normalized -match "convex\s+dev"
$usesLocalEnv = $normalized -match "--env-file\s+\.env\.local"
$usesOnce = $normalized -match "--once"
$usesTypecheckDisable = $normalized -match "--typecheck(?:=|\s+)disable"
$targetsAdamant = $normalized -match "adamant-armadillo-601"

$approvedDev = $isDevDeploy -and $usesOnce -and $usesTypecheckDisable -and $usesLocalEnv
$approvedProd = $isProdDeploy -and $usesTypecheckDisable

if ($approvedDev -or $approvedProd) {
  $result = @{
    hookSpecificOutput = @{
      hookEventName = "PreToolUse"
      permissionDecision = "allow"
      permissionDecisionReason = "Command matches approved Convex dual deploy workflow."
    }
  }
  $result | ConvertTo-Json -Compress
  exit 0
}

$reason = "Use the standardized Convex dual deploy workflow. Dev deploy for adamant-armadillo-601 must use: npx convex dev --once --typecheck=disable --env-file .env.local. Production deploy must use: npx convex deploy --yes --typecheck=disable. Prefer the /convex-dual-deploy skill for this workflow."
if ($targetsAdamant -and $isProdDeploy) {
  $reason = "adamant-armadillo-601 is the repo's dev deployment. Use: npx convex dev --once --typecheck=disable --env-file .env.local. Do not target it with convex deploy."
}

$result = @{
  hookSpecificOutput = @{
    hookEventName = "PreToolUse"
    permissionDecision = "deny"
    permissionDecisionReason = $reason
  }
}
$result | ConvertTo-Json -Compress
exit 2
