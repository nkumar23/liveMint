import { config as loadEnv } from 'dotenv';
import { MinterConfig } from './types';
import { NftMinter } from './services/NftMinter';
import * as fs from 'fs';
import { TriggerManager } from './services/TriggerManager';
import express from 'express';
import { Keypair, Connection } from '@solana/web3.js';
import * as os from 'os';
import * as readline from 'readline';

// Load environment variables
loadEnv();

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: { [key: string]: string } = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--network' && i + 1 < args.length) {
      options.network = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--ui') {
      options.ui = 'true';
    }
  }
  
  return options;
}

async function promptForNetwork(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('Which network do you want to use? (1) Devnet (2) Mainnet: ', (answer) => {
      rl.close();
      if (answer === '2') {
        console.log('Selected: Mainnet');
        resolve('mainnet');
      } else {
        console.log('Selected: Devnet');
        resolve('devnet');
      }
    });
  });
}

async function main() {
  // Parse command line arguments
  const cliOptions = parseArgs();
  
  // Check if UI flag is present
  const uiOnly = cliOptions.ui === 'true' || process.argv.includes('ui');
  
  // Determine network from CLI args, prompt, or .env
  let network: string;
  
  if (cliOptions.network) {
    // Network specified via CLI args
    network = cliOptions.network;
    console.log(`Network specified via command line: ${network}`);
  } else if (process.stdin.isTTY) {
    // Interactive mode - prompt for network
    network = await promptForNetwork();
  } else {
    // Non-interactive mode - use .env
    network = process.env.NETWORK || 'devnet';
    console.log(`Using network from .env: ${network}`);
  }
  
  // Validate network value
  if (network !== 'mainnet' && network !== 'devnet') {
    console.error(`Invalid network: ${network}. Using devnet as fallback.`);
    network = 'devnet';
  }
  
  // Set the network in process.env for other parts of the app
  process.env.NETWORK = network;
  
  // Create Express app for webhooks (only if not UI-only mode)
  const app = express();
  app.use(express.json());
  
  // Load trigger configurations from JSON file
  const triggerConfig = JSON.parse(fs.readFileSync('./triggers.json', 'utf-8'));
  
  const isMainnet = network === 'mainnet';
  console.log(`Running on Solana ${isMainnet ? 'MAINNET' : 'Devnet'}`);
  
  // Get the correct RPC URL based on selected network
  const rpcUrl = isMainnet 
    ? process.env.SOLANA_RPC_ENDPOINT_MAINNET 
    : process.env.SOLANA_RPC_ENDPOINT_DEVNET;
  
  if (!rpcUrl) {
    console.error(`ERROR: RPC URL not configured for ${network} in .env file`);
    process.exit(1);
  }
  
  console.log(`Using RPC URL: ${rpcUrl}`);
  
  // Select the appropriate wallet based on network
  const walletPath = isMainnet
    ? process.env.MAINNET_WALLET || process.env.ARTIST_WALLET
    : process.env.DEVNET_WALLET || process.env.ARTIST_WALLET;
  
  if (!walletPath) {
    console.error('ERROR: Wallet path not configured in .env file');
    process.exit(1);
  }
  
  console.log(`Using wallet: ${walletPath}`);
  
  // Check wallet balance
  try {
    const expandedWalletPath = walletPath.replace('~', os.homedir());
    const keypairData = JSON.parse(fs.readFileSync(expandedWalletPath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    const connection = new Connection(rpcUrl, 'confirmed');
    const balance = await connection.getBalance(keypair.publicKey);
    const solBalance = balance / 1_000_000_000;
    
    console.log(`Wallet address: ${keypair.publicKey.toString()}`);
    console.log(`Wallet balance: ${solBalance} SOL`);
    
    if (isMainnet && solBalance < 0.1) {
      console.warn('⚠️ WARNING: Low balance detected. You may need to add funds to this wallet.');
    }
  } catch (error) {
    console.error('Error checking wallet balance:', error);
  }
  
  // If mainnet, confirm the user wants to proceed
  if (isMainnet && process.stdin.isTTY && process.env.SKIP_CONFIRMATION !== 'true') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise<void>((resolve, reject) => {
      rl.question('⚠️ You are about to use MAINNET. Real transactions will be made. Continue? (yes/no): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'yes') {
          console.log('Proceeding with mainnet...');
          resolve();
        } else {
          console.log('Aborting...');
          process.exit(0);
        }
      });
    });
  }
  
  const config: MinterConfig = {
    rpcEndpoint: rpcUrl,
    artistWallet: walletPath,
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
  
  // Add a restart trigger endpoint to the webhook server
  app.post('/api/restart-trigger', async (req, res) => {
    try {
      const { triggerId } = req.body;
      
      console.log(`Received request to restart trigger ${triggerId}`);
      
      if (!triggerId) {
        return res.status(400).json({ error: 'Missing trigger ID' });
      }
      
      // Get the trigger listener
      const listener = triggerManager.getListener(triggerId);
      
      if (!listener) {
        return res.status(404).json({ error: 'Trigger not found' });
      }
      
      // Stop the trigger
      await listener.stop();
      console.log(`Stopped trigger ${triggerId}`);
      
      // Reload the trigger configuration
      const triggerConfig = JSON.parse(fs.readFileSync('./triggers.json', 'utf-8'));
      const config: MinterConfig = {
        rpcEndpoint: rpcUrl,
        artistWallet: walletPath,
        maxSupply: process.env.MAX_SUPPLY ? parseInt(process.env.MAX_SUPPLY) : null,
        triggerMappings: triggerConfig.triggers
      };
      
      // Reinitialize the trigger
      await triggerManager.reinitializeTrigger(triggerId, config);
      console.log(`Restarted trigger ${triggerId}`);
      
      res.json({ success: true, message: `Trigger ${triggerId} restarted` });
    } catch (error) {
      console.error('Error restarting trigger:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to restart trigger', details: errorMessage });
    }
  });
  
  // Start the webhook server (only if not UI-only mode)
  if (!uiOnly) {
    const PORT = process.env.WEBHOOK_PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Webhook server running at http://localhost:${PORT}`);
    });
  } else {
    console.log('Running in UI-only mode, webhook server not started');
  }
  
  console.log('Performance NFT Minter started. Waiting for triggers...');

  if (isMainnet) {
    // Mainnet-specific logic
    console.log('Running with mainnet-specific settings');
  }
}

main().catch(console.error); 