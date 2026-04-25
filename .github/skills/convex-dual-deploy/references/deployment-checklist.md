# Convex Dual Deploy Checklist

## Commands
- Validate/dev push: `npx convex dev --once --typecheck=disable --env-file .env.local`
- Prod push: `npx convex deploy --yes --typecheck=disable`
- Show repo deployment mapping: `Get-Content .env.local | Select-String "CONVEX_DEPLOYMENT|CONVEX_URL|NEXT_PUBLIC_CONVEX_URL"`
- Confirm git sync after push:
  - `git status --short --branch`
  - `git rev-parse HEAD`
  - `git rev-parse origin/<branch>`

## Expected Dev Mapping
- `CONVEX_DEPLOYMENT=dev:adamant-armadillo-601`
- `CONVEX_URL=https://adamant-armadillo-601.convex.cloud`
- `NEXT_PUBLIC_CONVEX_URL=https://adamant-armadillo-601.convex.cloud`

## Common Pitfalls
- `convex deploy` defaults to production.
- A plain deployment name without the `dev:` prefix may not select the intended dev deployment.
- PowerShell can surface successful git push output as a NativeCommandError; verify refs before treating it as failure.
