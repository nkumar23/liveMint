import { Connection } from '@solana/web3.js';
import { config as loadEnv } from 'dotenv';
import { execSync } from 'child_process';

loadEnv();

async function verifyNetwork() {
  console.log('Verifying Solana network configuration...');
  
  // Check .env settings
  const envNetwork = process.env.NETWORK || 'devnet';
  console.log(`1. Environment variable NETWORK=${envNetwork}`);
  
  // Get RPC URL from environment
  const mainnetRpc = process.env.SOLANA_RPC_ENDPOINT_MAINNET;
  const devnetRpc = process.env.SOLANA_RPC_ENDPOINT_DEVNET;
  const expectedRpc = envNetwork === 'mainnet' ? mainnetRpc : devnetRpc;
  
  console.log(`2. RPC URL for ${envNetwork}: ${expectedRpc}`);
  
  // Check Solana CLI config
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
    console.log(`3. Solana CLI config: ${cliNetwork}`);
  } catch (error) {
    console.error('Failed to get Solana CLI config:', error);
  }
  
  // Connect to the network and verify
  try {
    console.log(`4. Connecting to ${expectedRpc}...`);
    const connection = new Connection(expectedRpc!, 'confirmed');
    
    // Get genesis hash to identify the network
    const genesisHash = await connection.getGenesisHash();
    console.log(`   Genesis hash: ${genesisHash}`);
    
    const isMainnet = genesisHash === '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
    const actualNetwork = isMainnet ? 'mainnet' : 'devnet';
    
    console.log(`   Connected to: ${actualNetwork}`);
    
    // Check for mismatches
    if (envNetwork !== actualNetwork) {
      console.error(`❌ MISMATCH: .env says ${envNetwork} but connected to ${actualNetwork}`);
    } else {
      console.log(`✅ Confirmed: Connected to ${actualNetwork} as expected`);
    }
    
    // Check wallet balance
    const walletPath = process.env.ARTIST_WALLET;
    if (walletPath) {
      console.log(`5. Wallet path: ${walletPath}`);
      try {
        const balanceOutput = execSync(`solana balance -k ${walletPath} --url ${expectedRpc}`).toString();
        console.log(`   Wallet balance: ${balanceOutput.trim()}`);
      } catch (error) {
        console.error('   Failed to check wallet balance:', error);
      }
    }
    
    return {
      envNetwork,
      cliNetwork,
      actualNetwork,
      isMatch: envNetwork === actualNetwork
    };
  } catch (error) {
    console.error('Error verifying network connection:', error);
    throw error;
  }
}

// Run the verification
verifyNetwork()
  .then(result => {
    if (!result.isMatch) {
      console.error('\n⚠️ NETWORK CONFIGURATION ERROR: Your environment is not correctly configured.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  }); 