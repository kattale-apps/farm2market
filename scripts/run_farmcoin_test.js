const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.replace(/^--/, "").split("=");
      if (value === undefined) {
        args[key] = true;
      } else {
        args[key] = value;
      }
    }
  }
  return args;
}

const cli = parseArgs(process.argv.slice(2));
const mode = cli.env;

function readEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const [rawKey, ...rest] = line.split("=");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim();
    const value = rest.join("=").trim().replace(/^"|"$/g, "");
    result[key] = value;
  }
  return result;
}

const envLocal = readEnvLocal();
const deployment = process.env.CONVEX_DEPLOYMENT || envLocal.CONVEX_DEPLOYMENT;

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run FarmCoin test in production.");
  process.exit(1);
}

if (!deployment) {
  console.error("CONVEX_DEPLOYMENT not found. Refusing to run FarmCoin test.");
  process.exit(1);
}

if (deployment.startsWith("prod:")) {
  console.error("Refusing to run FarmCoin test against a production deployment.");
  process.exit(1);
}

if (mode !== "dev" && mode !== "test") {
  console.error("You must pass --env=dev or --env=test");
  process.exit(1);
}

const payload = {
  mode,
  superadminId: cli.superadminId,
  traderId: cli.traderId,
  resetLedger: Boolean(cli["reset-ledger"]),
  resetListings: Boolean(cli["reset-listings"]),
  cleanup: Boolean(cli.cleanup),
  cleanupOnly: Boolean(cli["cleanup-only"]),
  dryRun: Boolean(cli["dry-run"]),
};

const jsonArgs = JSON.stringify(payload);
console.log("Running: npx convex run farmcoinTest:runFarmcoinTokenTest", jsonArgs);

const res = spawnSync(
  "cmd",
  ["/c", "npx", "convex", "run", "farmcoinTest:runFarmcoinTokenTest", jsonArgs],
  { stdio: "inherit" }
);

if (res.error) {
  console.error("Spawn error:", res.error);
  process.exit(1);
}

process.exit(res.status || 0);
