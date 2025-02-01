import { config as loadEnv } from 'dotenv';
import { MinterConfig } from './types';
import { NftMinter } from './services/NftMinter';
import { MidiTriggerListener } from './triggers/TriggerListener';
import { Input } from 'easymidi';

loadEnv();

function getAvailableMidiDevices(): string[] {
  return Input.getPortNames();
}

async function main() {
  const midiDevices = getAvailableMidiDevices();
  if (midiDevices.length === 0) {
    throw new Error('No MIDI devices found. Please connect a MIDI device and try again.');
  }

  // Log available devices to help users
  console.log('Available MIDI devices:', midiDevices);

  const selectedDevice = process.env.MIDI_DEVICE_NAME || midiDevices[0];
  if (!midiDevices.includes(selectedDevice)) {
    throw new Error(`MIDI device "${selectedDevice}" not found. Available devices: ${midiDevices.join(', ')}`);
  }

  const channel = process.env.MIDI_CHANNEL ? parseInt(process.env.MIDI_CHANNEL) : 1;
  if (channel < 1 || channel > 16) {
    throw new Error('MIDI channel must be between 1 and 16');
  }

  const config: MinterConfig = {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    artistWallet: process.env.ARTIST_WALLET!,
    name: process.env.NFT_NAME || 'Performance NFT',
    symbol: process.env.NFT_SYMBOL || 'PERF',
    description: process.env.NFT_DESCRIPTION || 'Live Performance NFT',
    mediaFile: process.env.MEDIA_FILE!,
    maxSupply: process.env.MAX_SUPPLY ? parseInt(process.env.MAX_SUPPLY) : null,
    triggerType: 'midi',
    triggerConfig: {
      noteNumber: 60,
      deviceName: selectedDevice,
      channel: channel,
    },
  };

  console.log(`Using MIDI device: ${config.triggerConfig.deviceName} on channel ${config.triggerConfig.channel}`);

  const minter = new NftMinter(config);
  const trigger = new MidiTriggerListener(config.triggerConfig);

  trigger.onTrigger(async () => {
    await minter.mintNft();
  });

  await trigger.start();
  console.log('Performance NFT Minter started. Waiting for triggers...');
}

main().catch(console.error); 