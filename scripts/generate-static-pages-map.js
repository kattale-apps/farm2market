const fs = require('fs');
const path = require('path');

const root = process.cwd();
const appDir = path.join(root, 'app');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function routeFromFile(file) {
  const rel = path.relative(appDir, file).replace(/\\/g, '/');
  if (rel === 'page.tsx' || rel === 'page.ts') return '/';
  const noPage = rel.replace(/\/page\.tsx?$/, '');
  const segments = noPage.split('/').filter(Boolean).filter((s) => !(s.startsWith('(') && s.endsWith(')')));
  return segments.length ? '/' + segments.join('/') : '/';
}

function inferAccess(route, fileText, filePath) {
  const p = filePath.replace(/\\/g, '/').toLowerCase();
  const t = fileText.toLowerCase();
  if (p.includes('/(public)/')) return 'Public';
  if (['/login', '/forgot-password', '/reset-password', '/privacy-policy'].includes(route)) return 'Public';
  if (p.includes('/superadmin/') || route.startsWith('/superadmin')) return 'Superadmin';
  if (p.includes('/community-admin/') || route.startsWith('/community-admin') || p.includes('/(community)/admin/')) return 'Community Admin';
  if (route.startsWith('/farmer') || p.includes('/farmer/')) return 'Farmer';
  if (route.startsWith('/trader') || p.includes('/trader/')) return 'Trader';
  if (route.startsWith('/buyer') || p.includes('/buyer/')) return 'Buyer';
  if (t.includes('roleguard') || t.includes('pilot_user') || t.includes('router.push("/login")') || t.includes("router.push('/login')")) {
    return 'Authenticated (Farmer/Trader/Buyer)';
  }
  return 'Public';
}

function detectType(fileText) {
  const reasons = [];
  if (/generateStaticParams\s*\(/.test(fileText)) reasons.push('generateStaticParams');
  if (/dynamic\s*=\s*["']force-dynamic["']/.test(fileText)) reasons.push('force-dynamic');
  if (/\bcookies\s*\(/.test(fileText)) reasons.push('cookies()');
  if (/\bheaders\s*\(/.test(fileText)) reasons.push('headers()');
  if (/\bsearchParams\b/.test(fileText)) reasons.push('searchParams');
  if (/cache\s*:\s*["']no-store["']/.test(fileText) || /fetch\([\s\S]*?no-store[\s\S]*?\)/.test(fileText)) reasons.push('fetch no-store');
  return { type: reasons.length ? 'Dynamic' : 'Static', reasons };
}

function extractTitle(fileText, route) {
  const meta = fileText.match(/title\s*:\s*["'`]([^"'`]+)["'`]/);
  if (meta) return meta[1].trim();
  const h1 = fileText.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const h2 = fileText.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2) return h2[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (route === '/') return 'Landing Page';
  const last = route.split('/').filter(Boolean).slice(-1)[0] || 'Page';
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractComponents(fileText) {
  const names = new Set();
  for (const m of fileText.matchAll(/import\s+\{?\s*([A-Z][A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of fileText.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) names.add(m[1]);
  const blacklist = new Set(['React', 'Link', 'Image', 'Suspense']);
  return [...names].filter((n) => !blacklist.has(n)).slice(0, 6);
}

function inferPurpose(route, title, access) {
  if (route === '/') return 'Landing page and entry point.';
  if (route.includes('login')) return 'User authentication sign-in page.';
  if (route.includes('forgot-password')) return 'Initiates password reset via email/token.';
  if (route.includes('reset-password')) return 'Sets a new password from reset token.';
  if (route.includes('onboarding')) return 'Collects onboarding profile and setup details.';
  if (route.includes('dashboard')) return `${access} dashboard overview and actions.`;
  if (route.includes('my-communities')) return 'Lists and manages joined/suggested communities.';
  if (route.includes('/join/community/')) return 'Community join landing from QR/shared link.';
  if (route.includes('messages') || route.includes('messaging')) return 'Community messaging interface.';
  if (route.includes('noticeboard')) return 'Community noticeboard feed and announcements.';
  if (route.includes('profile')) return 'User profile management.';
  if (route.includes('privacy')) return 'Privacy and terms information.';
  if (route.includes('marketplace')) return 'Trading marketplace features and listings.';
  if (route.includes('usage')) return 'Administrative usage metrics and reporting.';
  return `${title || 'Page'} functionality.`;
}

const pages = walk(appDir).filter((f) => /page\.tsx?$/.test(f.replace(/\\/g, '/')));
const entries = pages.map((file) => {
  const text = fs.readFileSync(file, 'utf8');
  const route = routeFromFile(file);
  const { type, reasons } = detectType(text);
  return {
    route,
    file: path.relative(root, file).replace(/\\/g, '/'),
    type,
    reasons,
    access: inferAccess(route, text, file),
    title: extractTitle(text, route),
    components: extractComponents(text),
    purpose: inferPurpose(route, extractTitle(text, route), inferAccess(route, text, file)),
  };
}).sort((a, b) => a.route.localeCompare(b.route));

const total = entries.length;
const staticCount = entries.filter((e) => e.type === 'Static').length;
const dynamicCount = total - staticCount;

let md = '# App Static Pages Map\n\n';
md += '## Summary\n';
md += `- Total pages: ${total}\n`;
md += `- Static: ${staticCount}\n`;
md += `- Dynamic: ${dynamicCount}\n`;
md += '- Source: filesystem scan of app/**/page.tsx and app/**/page.ts\n\n';
md += '---\n\n';

for (const e of entries) {
  const typeLabel = e.type === 'Static' ? 'Static ' : `Dynamic ${e.reasons.length ? ` (reasons: ${e.reasons.join(', ')})` : ''}`;
  const comps = e.components.length ? e.components.join(', ') : 'None';
  md += `## ${e.route}\n\n`;
  md += `**File:** ${e.file}  \n`;
  md += `**Type:** ${typeLabel}  \n`;
  md += `**Access:** ${e.access}  \n`;
  md += `**Page Title:** ${e.title || 'N/A'}  \n`;
  md += `**Main Components:** ${comps}  \n`;
  md += `**Purpose:** ${e.purpose}\n\n`;
  md += '---\n\n';
}

function flow(title, filter) {
  const routes = entries.filter(filter).map((e) => `- ${e.route}`);
  md += `### ${title}\n`;
  md += routes.length ? routes.join('\n') + '\n\n' : '- None\n\n';
}

md += '## User Journey Mapping\n\n';
flow('Auth Flow', (e) => ['/login', '/forgot-password', '/reset-password'].includes(e.route) || e.route.includes('auth'));
flow('Onboarding Flow', (e) => e.route.includes('onboarding'));
flow('Dashboard Flow', (e) => e.route.includes('dashboard'));
flow('Community Flow', (e) => e.route.includes('community') || e.route.includes('my-communities') || e.route.includes('noticeboard') || e.route.includes('messaging') || e.route.includes('/join/'));
flow('Superadmin Flow', (e) => e.access === 'Superadmin' || e.route.startsWith('/superadmin'));

const docsDir = path.join(root, 'docs');
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'app-static-pages.md'), md, 'utf8');

console.log('Route | Type | Access | File');
console.log('---|---|---|---');
for (const e of entries) {
  console.log(`${e.route} | ${e.type} | ${e.access} | ${e.file}`);
}
console.log(`\nGenerated docs/app-static-pages.md with ${total} pages.`);
