import { config as loadEnv } from 'dotenv';
import { MinterConfig } from './types';
import { NftMinter } from './services/NftMinter';
import * as fs from 'fs';

loadEnv();

async function main() {
  // Load trigger configurations from JSON file
  const triggerConfig = JSON.parse(fs.readFileSync('./triggers.json', 'utf-8'));
  
  const config: MinterConfig = {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com',
    artistWallet: process.env.ARTIST_WALLET!,
    maxSupply: process.env.MAX_SUPPLY ? parseInt(process.env.MAX_SUPPLY) : null,
    triggerMappings: triggerConfig.triggers
  };

  const minter = new NftMinter(config);
  await minter.startListening();
  console.log('Performance NFT Minter started. Waiting for triggers...');
}

main().catch(console.error); 