# Deployment Checklist

Use this checklist to ensure a smooth deployment process.

## Pre-Deployment

- [ ] All code changes committed to Git
- [ ] No linting errors: `npm run lint`
- [ ] Build succeeds locally: `npm run build`
- [ ] Convex dev mode works: `npx convex dev`
- [ ] All environment variables documented
- [ ] `.gitignore` properly configured
- [ ] No sensitive data in code (API keys, passwords, etc.)

## GitHub Setup

- [ ] GitHub repository created
- [ ] Git remote configured
- [ ] All files committed
- [ ] Code pushed to GitHub
- [ ] Repository is private (if needed)
- [ ] README.md is up to date

## Convex Deployment

- [ ] Convex CLI installed: `npm install -g convex`
- [ ] Logged in to Convex: `npx convex login`
- [ ] Convex project initialized
- [ ] Schema deployed successfully
- [ ] All functions deployed
- [ ] Convex deployment URL saved
- [ ] Dashboard accessible
- [ ] Test query executed successfully

## Vercel Deployment

- [ ] Vercel account created
- [ ] GitHub repository connected
- [ ] Project imported to Vercel
- [ ] Build settings configured
- [ ] Environment variables added:
  - [ ] `NEXT_PUBLIC_CONVEX_URL`
  - [ ] `NEXT_PUBLIC_DEPLOYMENT_MODE`
- [ ] Initial deployment successful
- [ ] Production URL accessible
- [ ] No build errors in logs

## Post-Deployment Verification

- [ ] Frontend loads without errors
- [ ] Login page accessible
- [ ] Can create user account
- [ ] Can log in successfully
- [ ] Dashboard loads for each role
- [ ] Convex queries work
- [ ] Convex mutations work
- [ ] No console errors in browser

## Initial Data Setup

- [ ] SuperAdmin user created
- [ ] At least one district created
- [ ] At least one subcounty created
- [ ] At least one parish created
- [ ] Storage locations created
- [ ] Produce options created
- [ ] System settings configured:
  - [ ] Trader commission percentage
  - [ ] Storage fee rate
  - [ ] Buyer service fee
  - [ ] Pilot mode disabled (if production)

## Security

- [ ] Environment variables secured
- [ ] No secrets in code
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] CORS configured (if needed)
- [ ] Authentication working
- [ ] Authorization checks in place

## Monitoring

- [ ] Error tracking set up (optional)
- [ ] Analytics configured (optional)
- [ ] Monitoring dashboard accessible
- [ ] Alerts configured (optional)

## Documentation

- [ ] Deployment guide reviewed
- [ ] README.md updated
- [ ] Environment variables documented
- [ ] API endpoints documented (if needed)
- [ ] User guide created (if needed)

## Final Checks

- [ ] All features tested in production
- [ ] Performance acceptable
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility checked
- [ ] Backup strategy in place
- [ ] Rollback plan documented

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Production URL**: _______________
**Convex URL**: _______________
**GitHub Repo**: _______________
