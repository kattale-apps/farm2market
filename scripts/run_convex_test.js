const { spawnSync } = require('child_process');

const payload = {
  adminId: 'k974a84y0xwewwx4ttpr14zhnd7yzqz9',
  name: 'TestCommunity3',
  isGlobal: true,
  geoLocked: false,
  communityType: 'farmer',
};

const jsonArgs = JSON.stringify(payload);
console.log('Running: npx convex run communities:createCommunity', jsonArgs);

// On Windows, spawn the command via cmd.exe to ensure npx is found
const res = spawnSync('cmd', ['/c', 'npx', 'convex', 'run', 'communities:createCommunity', jsonArgs], { stdio: 'inherit' });
if (res.error) {
  console.error('Spawn error:', res.error);
  process.exit(1);
}
process.exit(res.status || 0);
