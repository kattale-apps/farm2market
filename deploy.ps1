# Farm2Market Uganda - Deployment Script (PowerShell)
# This script helps deploy to Convex, Vercel, and GitHub

Write-Host "🚀 Farm2Market Uganda - Deployment Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check prerequisites
Write-Host "Step 1: Checking prerequisites..." -ForegroundColor Blue
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Yellow
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✓ npm installed: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  npm is not installed." -ForegroundColor Yellow
    exit 1
}

# Check Git
try {
    $gitVersion = git --version
    Write-Host "✓ Git installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Git is not installed. Please install Git first." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Install dependencies
Write-Host "Step 2: Installing dependencies..." -ForegroundColor Blue
npm install
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Build check
Write-Host "Step 3: Running build check..." -ForegroundColor Blue
npm run build
Write-Host "✓ Build successful" -ForegroundColor Green
Write-Host ""

# Step 4: Lint check
Write-Host "Step 4: Running lint check..." -ForegroundColor Blue
npm run lint
Write-Host "✓ Lint check complete" -ForegroundColor Green
Write-Host ""

# Step 5: Git status
Write-Host "Step 5: Checking Git status..." -ForegroundColor Blue
$gitStatus = git status --porcelain
if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "✓ Working directory clean" -ForegroundColor Green
} else {
    Write-Host "⚠️  Uncommitted changes detected" -ForegroundColor Yellow
    Write-Host "Files with changes:"
    git status --short
    Write-Host ""
    $commit = Read-Host "Do you want to commit these changes? (y/n)"
    if ($commit -eq "y" -or $commit -eq "Y") {
        git add .
        $commitMsg = Read-Host "Enter commit message (or press Enter for default)"
        if ([string]::IsNullOrWhiteSpace($commitMsg)) {
            $commitMsg = "Deploy: UX Extensions v1.2"
        }
        git commit -m $commitMsg
        Write-Host "✓ Changes committed" -ForegroundColor Green
    }
}
Write-Host ""

# Step 6: Deploy to Convex
Write-Host "Step 6: Deploying to Convex..." -ForegroundColor Blue
Write-Host "Make sure you're logged in to Convex: npx convex login" -ForegroundColor Yellow
Read-Host "Press Enter to continue with Convex deployment"
npx convex deploy --yes
Write-Host "✓ Convex deployment complete" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Save your Convex deployment URL for Vercel configuration" -ForegroundColor Yellow
Write-Host ""

# Step 7: Deploy to Vercel
Write-Host "Step 7: Deploying to Vercel..." -ForegroundColor Blue
Write-Host "Make sure you're logged in to Vercel: vercel login" -ForegroundColor Yellow
Read-Host "Press Enter to continue with Vercel deployment"
vercel --prod
Write-Host "✓ Vercel deployment complete" -ForegroundColor Green
Write-Host ""

# Step 8: Push to GitHub
Write-Host "Step 8: Pushing to GitHub..." -ForegroundColor Blue
$push = Read-Host "Do you want to push to GitHub? (y/n)"
if ($push -eq "y" -or $push -eq "Y") {
    try {
        $remoteUrl = git remote get-url origin
        $branch = git branch --show-current
        git push origin $branch
        Write-Host "✓ Pushed to GitHub" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  No GitHub remote configured or push failed" -ForegroundColor Yellow
        Write-Host "To set up GitHub remote, run:"
        Write-Host "  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
        Write-Host "  git push -u origin main"
    }
}
Write-Host ""

Write-Host "🎉 Deployment process complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Configure environment variables in Vercel dashboard"
Write-Host "2. Set NEXT_PUBLIC_CONVEX_URL to your Convex deployment URL"
Write-Host "3. Test your deployment"
Write-Host "4. Set up initial data (districts, subcounties, etc.)"
Write-Host ""
Write-Host "See DEPLOYMENT_GUIDE.md for detailed instructions."
