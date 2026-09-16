const fs = require('fs');
const path = require('path');

const targets = [
  'node_modules/@solana/wallet-adapter-react/node_modules/@types/react',
  'node_modules/@solana-mobile/wallet-standard-mobile/node_modules/@types/react',
  'node_modules/@solana-mobile/mobile-wallet-adapter-protocol-web3js/node_modules/@types/react',
];

for (const target of targets) {
  const fullPath = path.join(__dirname, '..', target);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Removed: ${target}`);
  } else {
    console.log(`Not found (already clean): ${target}`);
  }
}
