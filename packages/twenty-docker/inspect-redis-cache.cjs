const { Client } = require('pg');
const { execSync } = require('child_process');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  // Check Redis keys for FindAllViews
  const out = execSync('redis-cli keys "*FindAllViews*"').toString();
  console.log('Redis FindAllViews keys:', out);

  if (out.trim()) {
    const key = out.trim().split('\n')[0].trim();
    const val = execSync(`redis-cli get "${key}"`).toString();
    const parsed = JSON.parse(val);
    const personView = parsed.find(v => v.id === '3ba023cc-ed9c-4ebe-888c-561424e7e3eb');
    console.log('Cached person view in Redis:');
    if (personView) {
      console.log('Name:', personView.name);
      console.log('viewFields count:', personView.viewFields ? personView.viewFields.length : 0);
      if (personView.viewFields) {
        console.table(personView.viewFields.map(vf => ({ id: vf.id, fieldMetadataId: vf.fieldMetadataId, isVisible: vf.isVisible, position: vf.position })));
      }
    } else {
      console.log('Not found in FindAllViews cache');
    }
  }

  await c.end();
}

run().catch(console.error);

