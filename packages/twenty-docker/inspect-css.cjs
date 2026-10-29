const fs = require('fs');

const bundlePath = '/app/packages/twenty-server/dist/front/assets/CreateProfile-CEqO-5jb.js';
const code = fs.readFileSync(bundlePath, 'utf8');

const idx = code.indexOf('industry-cards-grid');
if (idx !== -1) {
  console.log(code.substring(idx - 200, idx + 400));
}
