import { config as loadEnv } from 'dotenv';
import { MinterConfig, KeyboardTriggerConfig } from './types';
import { NftMinter } from './services/NftMinter';

loadEnv();

async function testKeyboardTrigger() {
  const config: MinterConfig = {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT!,
    artistWallet: process.env.ARTIST_WALLET!,
    name: process.env.NFT_NAME!,
    symbol: process.env.NFT_SYMBOL!,
    description: process.env.NFT_DESCRIPTION!,
    mediaFile: process.env.MEDIA_FILE!,
    maxSupply: process.env.MAX_SUPPLY ? parseInt(process.env.MAX_SUPPLY) : null,
    triggerType: 'keyboard',
    triggerConfig: {
      key: '9'
    } as KeyboardTriggerConfig,
  };

  try {
    console.log('Testing keyboard trigger (Press 9 to mint, Ctrl+C to exit)...');
    const minter = new NftMinter(config);
    await minter.startListening();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testKeyboardTrigger().catch(console.error); 