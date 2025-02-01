import { config as loadEnv } from 'dotenv';
import { MinterConfig, MidiTriggerConfig } from './types';
import { NftMinter } from './services/NftMinter';
import { MidiTriggerListener } from './triggers/TriggerListener';

loadEnv();

async function test() {
  const config: MinterConfig = {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT!,
    artistWallet: process.env.ARTIST_WALLET!,
    name: process.env.NFT_NAME!,
    symbol: process.env.NFT_SYMBOL!,
    description: process.env.NFT_DESCRIPTION!,
    mediaFile: process.env.MEDIA_FILE!,
    maxSupply: process.env.MAX_SUPPLY ? parseInt(process.env.MAX_SUPPLY) : null,
    triggerType: 'midi',
    triggerConfig: {
      noteNumber: 60, // Middle C
    } as MidiTriggerConfig,
  };

  try {
    // Test NFT minting first
    console.log('Testing NFT minting...');
    const minter = new NftMinter(config);
    const result = await minter.mintNft();
    console.log('Mint successful:', result);

    // Then test MIDI trigger
    console.log('\nTesting MIDI trigger...');
    if (config.triggerType === 'midi') {
      const trigger = new MidiTriggerListener(config.triggerConfig as MidiTriggerConfig);
      
      trigger.onTrigger(async () => {
        console.log('Trigger received, minting NFT...');
        await minter.mintNft();
      });

      await trigger.start();
      console.log('MIDI listener started. Press middle C (note 60) to mint an NFT. Press Ctrl+C to exit.');
    } else {
      console.log('Config is not set for MIDI triggering');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

test().catch(console.error); 