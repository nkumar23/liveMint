import { config as loadEnv } from 'dotenv';
import { MinterConfig, MidiTriggerConfig } from './types';
import { NftMinter } from './services/NftMinter';

loadEnv();

async function testMidiTrigger() {
  const config: MinterConfig = {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT!,
    artistWallet: process.env.ARTIST_WALLET!,
    maxSupply: process.env.MAX_SUPPLY ? parseInt(process.env.MAX_SUPPLY) : null,
    triggerMappings: [
      {
        id: 'midi-test',
        type: 'midi',
        config: {
          noteNumber: 60,  // MIDI note 60 is middle C
          deviceName: process.env.MIDI_DEVICE  // Use device from .env
        } as MidiTriggerConfig,
        nftMetadata: {
          name: 'Test MIDI NFT #{count}',
          symbol: process.env.NFT_SYMBOL || 'TEST',
          description: 'Test MIDI NFT created at {timestamp}',
          mediaFile: './assets/test-image.jpg',  // Use a test image
          attributes: {
            test: true,
            note: 'C4'
          }
        }
      }
    ]
  };

  try {
    console.log('Testing MIDI trigger (Send MIDI note 60 to trigger, Ctrl+C to exit)...');
    console.log(`Using MIDI device: ${process.env.MIDI_DEVICE}`);
    const minter = new NftMinter(config);
    await minter.startListening();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMidiTrigger().catch(console.error); 