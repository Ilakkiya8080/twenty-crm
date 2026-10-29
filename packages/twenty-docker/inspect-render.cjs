const fs = require('fs');

const bundlePath = '/app/packages/twenty-server/dist/front/assets/CreateProfile-CEqO-5jb.js';
const code = fs.readFileSync(bundlePath, 'utf8');

const idx = code.indexOf('INDUSTRY_OPTIONS');
console.log(code.substring(idx, idx + 2500));
