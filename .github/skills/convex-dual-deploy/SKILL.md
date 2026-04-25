---
name: convex-dual-deploy
description: 'Deploy Convex changes to both dev and production environments for this repo. Use when asked to deploy Convex, push functions to adamant-armadillo-601 dev, deploy to production, verify target URLs, and optionally commit or report deployment status.'
argument-hint: 'Describe what to deploy and whether commit/push is also required'
user-invocable: true
disable-model-invocation: false
---

# Convex Dual Deploy

Use this skill for the Farm2Market repository when Convex changes must be deployed to both the configured dev environment and the production deployment.

## When to Use
- The user asks to deploy Convex changes.
- The user says to deploy to dev and prod.
- The user references `adamant-armadillo-601`.
- The user wants a release flow that includes validation before or after deployment.
- The user wants deployment plus commit/push as one workflow.

## Repository-Specific Facts
- Dev deployment is selected from `.env.local` with `CONVEX_DEPLOYMENT=dev:adamant-armadillo-601`.
- Dev deployment URL is `https://adamant-armadillo-601.convex.cloud`.
- `convex deploy` targets production by default.
- `convex dev --once --env-file .env.local` is the correct dev push command for this repo.
- `convex deploy --yes --typecheck=disable` is the production push command used in this repo.

## Procedure
1. Inspect git status before deployment if code may also need committing.
2. Validate the Convex code locally with:
   - `npx convex dev --once --typecheck=disable --env-file .env.local`
3. Deploy to the repo's dev deployment with:
   - `npx convex dev --once --typecheck=disable --env-file .env.local`
4. Confirm the dev target mapping from `.env.local` if needed:
   - `CONVEX_DEPLOYMENT=dev:adamant-armadillo-601`
   - `CONVEX_URL=https://adamant-armadillo-601.convex.cloud`
5. Deploy to production with:
   - `npx convex deploy --yes --typecheck=disable`
6. Read command output carefully and report the deployed URL for each successful deploy.
7. If the user also requested git actions, stage only intended files, commit with a focused message, push the current branch, and verify local `HEAD` equals the remote branch head.

## Decision Points
- If the user asks for `adamant-armadillo-601`, treat that as the dev deployment and use `convex dev --once --env-file .env.local`, not `convex deploy`.
- If `convex deploy` succeeds but appears to point at a different URL than the requested dev deployment, explain that prod and dev are different targets and verify `.env.local` selectors.
- If PowerShell reports a non-zero exit code around `git push` but the output shows the ref updated, verify success with `git rev-parse HEAD` and `git rev-parse origin/<branch>`.
- If a deploy command fails, do not stop at the first failure. Inspect the exact CLI output, correct the environment or command shape, and retry.
- If `.env.local` is missing or does not contain `adamant-armadillo-601`, stop and determine the correct env file before deploying to dev.

## Completion Checks
- Dev deployment command completed successfully.
- Production deployment command completed successfully when requested.
- Reported target URLs match the intended environment.
- Any requested commit exists and has been pushed.
- Remote branch ref matches local `HEAD` after push.
- No unrelated files were staged or reverted.

## Reference
- Use the concise release checklist in [deployment-checklist](./references/deployment-checklist.md).
