import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Get the network from command line arguments
const args = process.argv.slice(2);
const network = args[0]?.toLowerCase();

if (network !== 'mainnet' && network !== 'devnet') {
  console.error('Please specify either "mainnet" or "devnet"');
  process.exit(1);
}

// Update the .env file
const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');

// Replace the NETWORK line
envContent = envContent.replace(
  /NETWORK=\w+/,
  `NETWORK=${network}`
);

fs.writeFileSync(envPath, envContent);

// Update Solana CLI config
const rpcUrl = network === 'mainnet'
  ? 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com';

try {
  execSync(`solana config set --url "${rpcUrl}"`, { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to update Solana CLI config:', error);
}

console.log(`Switched to ${network.toUpperCase()}`);
console.log('Updated:');
console.log(`1. .env file (NETWORK=${network})`);
console.log(`2. Solana CLI config (url=${rpcUrl})`); 