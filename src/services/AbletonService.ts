import * as easymidi from 'easymidi';
import { AbletonTriggerConfig } from '../types';
import * as robotjs from 'robotjs';

export class AbletonService {
  private output: easymidi.Output | null = null;

  constructor(private config: AbletonTriggerConfig) {
    // Initialize MIDI output
    this.output = new easymidi.Output(config.deviceName);
  }

  async triggerExport(): Promise<string> {
    console.log('Triggering Ableton export...');
    
    // Simulate the key command for export (Shift + Cmd + R on Mac, Shift + Ctrl + R on Windows)
    if (process.platform === 'darwin') {
      robotjs.keyTap('r', ['shift', 'command']);
    } else {
      robotjs.keyTap('r', ['shift', 'control']);
    }

    // Wait for the export dialog
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Press Enter to accept default export settings
    robotjs.keyTap('enter');

    return process.env.ABLETON_EXPORT_PATH + '/exported.wav';
  }

  cleanup() {
    if (this.output) {
      this.output.close();
    }
  }
} 