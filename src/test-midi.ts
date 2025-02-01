import { config as loadEnv } from 'dotenv';
import { MinterConfig, MidiTriggerConfig } from './types';
import { NftMinter } from './services/NftMinter';

loadEnv();

async function testMidiTrigger() {
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
      noteNumber: 60,  // MIDI note 60 is middle C
      deviceName: process.env.MIDI_DEVICE  // Optional: specify in .env
    } as MidiTriggerConfig,
  };

  try {
    console.log('Testing MIDI trigger (Send MIDI note 60 to trigger, Ctrl+C to exit)...');
    const minter = new NftMinter(config);
    await minter.startListening();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMidiTrigger().catch(console.error); 