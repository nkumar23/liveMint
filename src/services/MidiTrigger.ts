import * as easymidi from 'easymidi';
import { MidiTriggerConfig } from '../types';

export class MidiTrigger {
  private inputs: string[] = [];
  private activeInput: easymidi.Input | null = null;

  constructor() {
    this.inputs = easymidi.getInputs();
    console.log('Available MIDI inputs:', this.inputs);
  }

  async listen(config: MidiTriggerConfig, onTrigger: () => Promise<void>) {
    // If no specific device is specified, use the first available one
    const deviceName = config.deviceName || this.inputs[0];
    
    if (!deviceName) {
      throw new Error('No MIDI input devices found');
    }

    console.log(`Listening on MIDI device: ${deviceName}`);
    this.activeInput = new easymidi.Input(deviceName);

    // Listen for note on messages
    this.activeInput.on('noteon', async (msg) => {
      console.log('MIDI Note:', msg.note, 'Velocity:', msg.velocity);
      
      if (msg.note === config.noteNumber) {
        console.log('MIDI trigger activated!');
        await onTrigger();
      }
    });
  }

  cleanup() {
    if (this.activeInput) {
      this.activeInput.close();
    }
  }
} 