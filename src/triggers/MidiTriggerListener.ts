import * as easymidi from 'easymidi';
import { TriggerListener } from './TriggerListener';

export interface MidiTriggerConfig {
  noteNumber: number;
  deviceName?: string;
  channel?: number;
}

export class MidiTriggerListener implements TriggerListener {
  private config: MidiTriggerConfig;
  private input: any = null;
  private callback: (timestamp: Date) => void;

  constructor(config: MidiTriggerConfig, callback: (timestamp: Date) => void) {
    this.config = config;
    this.callback = callback;
  }

  async start(): Promise<void> {
    try {
      // Use the correct method to get inputs
      const inputs = await new Promise<string[]>((resolve) => {
        const availableInputs = easymidi.getInputs ? easymidi.getInputs() : [];
        resolve(availableInputs);
      });
      
      console.log('Available MIDI input ports:', inputs);
      
      if (inputs.length === 0) {
        console.error('No MIDI devices found!');
        return;
      }
      
      // Use specified device or first available
      const deviceName = this.config.deviceName || inputs[0];
      
      this.input = new easymidi.Input(deviceName);
      console.log(`Listening to MIDI device: ${deviceName}`);
      
      // Listen for note on events
      this.input.on('noteon', (msg: any) => {
        // Check if this is the note we're looking for
        if (msg.note === this.config.noteNumber) {
          // If channel is specified, check it matches
          if (this.config.channel !== undefined && msg.channel !== this.config.channel) {
            return;
          }
          
          console.log(`MIDI note ${msg.note} detected on channel ${msg.channel}`);
          this.callback(new Date());
        }
      });
    } catch (error) {
      console.error('Error starting MIDI listener:', error);
    }
  }

  async stop(): Promise<void> {
    if (this.input) {
      this.input.close();
      this.input = null;
      console.log('MIDI listener stopped');
    }
    return Promise.resolve();
  }
} 