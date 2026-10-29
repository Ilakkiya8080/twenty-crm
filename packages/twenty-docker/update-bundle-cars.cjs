const fs = require('fs');

const bundlePath = '/app/packages/twenty-server/dist/front/assets/CreateProfile-CEqO-5jb.js';
let code = fs.readFileSync(bundlePath, 'utf8');

const targetItem = `{
    id: "realestate",
    title: "Real Estate CRM",
    desc: "Properties, Deals, Clients, Listings, Contracts & Commissions",
    img: "/assets/realestate.png",
    modules: ["Properties", "Listings", "Clients", "Deals", "Contracts", "Commissions"]
  }`;

const newItem = `{
    id: "realestate",
    title: "Real Estate CRM",
    desc: "Properties, Deals, Clients, Listings, Contracts & Commissions",
    img: "/assets/realestate.png",
    modules: ["Properties", "Listings", "Clients", "Deals", "Contracts", "Commissions"]
  },
  {
    id: "cars",
    title: "Cars CRM",
    desc: "Vehicles, Test Drives, Bookings, Dealerships, Inventory & Service",
    img: "/assets/images.png",
    modules: ["Vehicles", "Test Drives", "Bookings", "Dealerships", "Inventory", "Maintenance & Service"]
  }`;

if (!code.includes(targetItem)) {
  console.error('Target item not found in bundle');
  process.exit(1);
}

if (code.includes('id: "cars"')) {
  console.log('Cars card already present in bundle');
  process.exit(0);
}

code = code.replace(targetItem, newItem);
fs.writeFileSync(bundlePath, code, 'utf8');
console.log('Successfully updated bundle with 4th card (Cars CRM)!');
