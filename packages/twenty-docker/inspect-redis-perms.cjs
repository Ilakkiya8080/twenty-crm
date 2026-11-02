const { createClient } = require('redis');

async function run() {
  const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
  await redis.connect();

  const keys = await redis.keys('*');
  console.log('Redis keys count:', keys.length);
  for (const k of keys) {
    if (k.includes('rolesPermissions') || k.includes('role') || k.includes('objectMetadata')) {
      console.log('Key:', k);
      const val = await redis.get(k);
      console.log('Value length:', val ? val.length : 0);
      try {
        const parsed = JSON.parse(val);
        console.log('Parsed sample:', Object.keys(parsed));
        // Check workspaceMember in permissions
        for (const roleId in parsed) {
          const perms = parsed[roleId];
          if (perms['5647b1a0-9790-46c0-ab11-8b86f8828c93']) {
            console.log(`Role ${roleId} perms for workspaceMember:`, perms['5647b1a0-9790-46c0-ab11-8b86f8828c93']);
          }
        }
      } catch (e) {
        console.log('Not JSON');
      }
    }
  }

  await redis.quit();
}

run().catch(console.error);

