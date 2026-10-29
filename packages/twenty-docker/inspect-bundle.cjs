const fs = require('fs');

const bundlePath = '/app/packages/twenty-server/dist/front/assets/CreateProfile-CEqO-5jb.js';
const code = fs.readFileSync(bundlePath, 'utf8');

const idx = code.indexOf('Manufacturing CRM');
console.log('Index:', idx);
if (idx !== -1) {
  console.log('Snippet around Manufacturing CRM:');
  console.log(code.substring(Math.max(0, idx - 200), Math.min(code.length, idx + 800)));
}
