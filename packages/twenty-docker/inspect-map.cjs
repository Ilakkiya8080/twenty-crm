const fs = require('fs');

const bundlePath = '/app/packages/twenty-server/dist/front/assets/CreateProfile-CEqO-5jb.js';
const code = fs.readFileSync(bundlePath, 'utf8');

const idx = code.indexOf('.map');
console.log('Index of .map:', idx);
if (idx !== -1) {
  console.log(code.substring(idx - 50, idx + 1500));
}
