import { config as loadEnv } from 'dotenv';
import { MinterConfig } from './types';
import { NftMinter } from './services/NftMinter';
import * as fs from 'fs';
import { TriggerManager } from './services/TriggerManager';
import express from 'express';

loadEnv();

async function main() {
  // Create Express app for webhooks
  const app = express();
  app.use(express.json());
  
  // Load trigger configurations from JSON file
  const triggerConfig = JSON.parse(fs.readFileSync('./triggers.json', 'utf-8'));
  
  const config: MinterConfig = {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com',
    artistWallet: process.env.ARTIST_WALLET!,
    maxSupply: process.env.MAX_SUPPLY ? parseInt(process.env.MAX_SUPPLY) : null,
    triggerMappings: triggerConfig.triggers
  };

  // Initialize the NFT minter
  const minter = new NftMinter(config);
  await minter.initialize();
  
  // Initialize trigger manager with the Express app
  const triggerManager = new TriggerManager(config, minter, app);
  await triggerManager.initializeTriggers();
  
  // Add a test endpoint to the webhook server
  app.get('/api/webhook-test', (req, res) => {
    console.log('Webhook server test endpoint hit!');
    res.json({ success: true, message: 'Webhook server test endpoint working' });
  });
  
  // Start the webhook server
  const PORT = process.env.WEBHOOK_PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Webhook server running at http://localhost:${PORT}`);
  });
  
  console.log('Performance NFT Minter started. Waiting for triggers...');
}

main().catch(console.error); 