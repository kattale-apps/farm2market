<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Keep it simple

Design every screen for the basic, semi-literate user first: few choices, presets over free text, plain words, and light data (paginated, thumbnail-only lists). Build the data model so it can expand for more comprehensive users without a redesign. Protect both the buyer and the seller in every money or contact flow.

Photo inputs always offer camera and gallery upload together (use `GeneralCameraCapture` or `PhotoSetCapture`), so a user who cannot take a picture can still upload one.

## Deployment rules

Convex deployments: **dev = `adamant-armadillo`**, **prod = `greedy-tortoise`**. The git remote is `github`. The Convex Dual Deploy workflow deploys `develop` to dev and `main` to prod. Name the target deployment before any command that deploys or writes data.

Release in this order, every time:

1. **Feature branch.** Branch off `develop` and commit the work there.
2. **Check locally.** `npx tsc --noEmit -p .`, `npm test`, lint the changed files, and `npx next build` must all pass.
3. **Merge to develop and push.** `git merge --no-ff <branch>` into `develop`, then `git push github develop`. Wait for the CI run to succeed: dev is now deployed.
4. **Verify on dev.** Drive the change as real users with the test accounts and sessions in `convex/lotOrdersDevCheck.ts` (`mode: "dev"`), then run its `cleanup` so no test data stays on dev.
5. **Release to prod (explicit yes only).** With the user's explicit approval for this release, `git merge --no-ff develop` into `main` (main's files must then match develop) and `git push github main`. Wait for the CI run to succeed: prod is now deployed.
6. **Prod data steps and smoke check.** Run any one-off backfills, seeds or migrations with `npx convex run --prod <module>:<function>`, then smoke-check prod read-only (no test data on prod).

Never push `main` or run anything with `--prod` without that explicit yes. `npx convex codegen` only regenerates code; afterwards restore `convex/_generated/server.d.ts` and `convex/_generated/server.js` with `git checkout` (the local CLI drops their `env` export).
