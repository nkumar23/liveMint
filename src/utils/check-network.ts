import { config as loadEnv } from 'dotenv';
import { execSync } from 'child_process';

loadEnv();

// Get network from .env
const envNetwork = process.env.NETWORK || 'devnet';

// Get Solana CLI config
let cliNetwork = 'unknown';
try {
  const configOutput = execSync('solana config get').toString();
  const match = configOutput.match(/RPC URL: (https?:\/\/[^\s]+)/);
  if (match) {
    const url = match[1];
    if (url.includes('mainnet')) {
      cliNetwork = 'mainnet';
    } else if (url.includes('devnet')) {
      cliNetwork = 'devnet';
    } else {
      cliNetwork = url;
    }
  }
} catch (error) {
  console.error('Failed to get Solana CLI config:', error);
}

console.log('Network Configuration:');
console.log(`1. .env file: NETWORK=${envNetwork}`);
console.log(`2. Solana CLI: ${cliNetwork}`);

if (envNetwork !== cliNetwork && (cliNetwork === 'mainnet' || cliNetwork === 'devnet')) {
  console.warn('\n⚠️ WARNING: Your .env and Solana CLI configurations are using different networks!');
} 