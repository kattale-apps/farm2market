# Repository Instructions

## Convex Deployment Standard

- When the user asks to "deploy Convex" (or equivalent phrasing such as "deploy to convex", "push convex", "release convex", "deploy convex dev and prod"), prefer and invoke the `convex-dual-deploy` skill workflow.
- Do not use ad-hoc Convex deploy command variants when the `convex-dual-deploy` skill applies.
- Follow the standardized dual flow:
  - Dev deployment for this repo: `npx convex dev --once --typecheck=disable --env-file .env.local`
  - Production deployment for this repo: `npx convex deploy --yes --typecheck=disable`
- Treat `adamant-armadillo-601` as the dev deployment target for this repo.
- If the user explicitly requests only one environment, use the corresponding part of the standardized workflow and state that scope clearly.
