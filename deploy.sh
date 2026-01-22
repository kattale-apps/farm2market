#!/bin/bash

# Farm2Market Uganda - Deployment Script
# This script helps deploy to Convex, Vercel, and GitHub

set -e  # Exit on error

echo "🚀 Farm2Market Uganda - Deployment Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠️  npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm installed: $(npm --version)${NC}"

# Check Git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠️  Git is not installed. Please install Git first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git installed: $(git --version)${NC}"

echo ""

# Step 2: Install dependencies
echo -e "${BLUE}Step 2: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Build check
echo -e "${BLUE}Step 3: Running build check...${NC}"
npm run build
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Step 4: Lint check
echo -e "${BLUE}Step 4: Running lint check...${NC}"
npm run lint || echo -e "${YELLOW}⚠️  Lint warnings (non-blocking)${NC}"
echo ""

# Step 5: Git status
echo -e "${BLUE}Step 5: Checking Git status...${NC}"
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}✓ Working directory clean${NC}"
else
    echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
    echo "Files with changes:"
    git status --short
    echo ""
    read -p "Do you want to commit these changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        read -p "Enter commit message: " commit_msg
        git commit -m "${commit_msg:-Deploy: UX Extensions v1.2}"
        echo -e "${GREEN}✓ Changes committed${NC}"
    fi
fi
echo ""

# Step 6: Deploy to Convex
echo -e "${BLUE}Step 6: Deploying to Convex...${NC}"
echo -e "${YELLOW}Make sure you're logged in to Convex: npx convex login${NC}"
read -p "Press Enter to continue with Convex deployment..."
npx convex deploy --yes
echo -e "${GREEN}✓ Convex deployment complete${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Save your Convex deployment URL for Vercel configuration${NC}"
echo ""

# Step 7: Deploy to Vercel
echo -e "${BLUE}Step 7: Deploying to Vercel...${NC}"
echo -e "${YELLOW}Make sure you're logged in to Vercel: vercel login${NC}"
read -p "Press Enter to continue with Vercel deployment..."
vercel --prod
echo -e "${GREEN}✓ Vercel deployment complete${NC}"
echo ""

# Step 8: Push to GitHub
echo -e "${BLUE}Step 8: Pushing to GitHub...${NC}"
read -p "Do you want to push to GitHub? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if remote exists
    if git remote get-url origin &> /dev/null; then
        git push origin main || git push origin master
        echo -e "${GREEN}✓ Pushed to GitHub${NC}"
    else
        echo -e "${YELLOW}⚠️  No GitHub remote configured${NC}"
        echo "To set up GitHub remote, run:"
        echo "  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
        echo "  git push -u origin main"
    fi
fi
echo ""

echo -e "${GREEN}🎉 Deployment process complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in Vercel dashboard"
echo "2. Set NEXT_PUBLIC_CONVEX_URL to your Convex deployment URL"
echo "3. Test your deployment"
echo "4. Set up initial data (districts, subcounties, etc.)"
echo ""
echo "See DEPLOYMENT_GUIDE.md for detailed instructions."
