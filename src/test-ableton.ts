import { config as loadEnv } from 'dotenv';
import { MinterConfig, AbletonTriggerConfig } from './types';
import { NftMinter } from './services/NftMinter';
import { AbletonService } from './services/AbletonService';

loadEnv();

async function testAbletonExport() {
  const config: AbletonTriggerConfig = {
    exportNoteNumber: 61,  // Note C#4
    deviceName: process.env.MIDI_DEVICE!,
    settings: {
      format: 'wav',
      sampleRate: 48000,
      bitDepth: 24
    }
  };

  try {
    console.log('Testing Ableton export...');
    console.log('Make sure Ableton Live is in focus!');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give time to switch to Ableton
    
    const ableton = new AbletonService(config);
    const exportedFile = await ableton.triggerExport();
    console.log('Export completed:', exportedFile);

    ableton.cleanup();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAbletonExport().catch(console.error); 