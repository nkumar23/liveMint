import { MidiTriggerConfig } from '../types';

export interface TriggerListener {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class MidiTriggerListener implements TriggerListener {
  private midi: any;
  private callback: (() => Promise<void>) | null = null;
  private config: MidiTriggerConfig;

  constructor(config: MidiTriggerConfig) {
    this.config = config;
  }

  async start() {
    const midi = require('midi');
    this.midi = new midi.Input();
    
    // List available MIDI ports
    console.log('Available MIDI input ports:');
    for (let i = 0; i < this.midi.getPortCount(); i++) {
      console.log(`[${i}] ${this.midi.getPortName(i)}`);
    }
    
    if (this.midi.getPortCount() === 0) {
      throw new Error('No MIDI input ports available');
    }
    
    this.midi.on('message', (deltaTime: number, message: number[]) => {
      const [status, note, velocity] = message;
      console.log(`MIDI message received - note: ${note}, velocity: ${velocity}`);
      
      if (note === this.config.noteNumber) {
        this.callback?.();
      }
    });

    // Open the first available input port
    this.midi.openPort(0);
    console.log(`Opened MIDI port: ${this.midi.getPortName(0)}`);
  }

  stop() {
    if (this.midi) {
      this.midi.closePort();
    }
  }

  onTrigger(callback: () => Promise<void>) {
    this.callback = callback;
  }
} 