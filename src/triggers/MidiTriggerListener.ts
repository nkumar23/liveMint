import * as easymidi from 'easymidi';
import { MidiTriggerConfig } from '../types';
import { TriggerListener } from './TriggerListener';

export class MidiTriggerListener implements TriggerListener {
  private input: easymidi.Input | null = null;
  private callback: (() => Promise<void>) | null = null;
  private config: MidiTriggerConfig;
  private noteNames: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  constructor(config: MidiTriggerConfig) {
    this.config = config;
  }

  // Convert MIDI note number to note name (e.g., 60 -> "C4")
  private getNoteNameFromNumber(noteNumber: number): string {
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = this.noteNames[noteNumber % 12];
    return `${noteName}${octave}`;
  }

  async start() {
    const inputs = easymidi.getInputs();
    console.log('Available MIDI input ports:', inputs);
    
    if (inputs.length === 0) {
      throw new Error('No MIDI input ports available');
    }
    
    const deviceName = this.config.deviceName || inputs[0];
    console.log(`Attempting to connect to MIDI device: "${deviceName}"`);
    
    if (!inputs.includes(deviceName)) {
      console.error(`⚠️ MIDI device "${deviceName}" not found in available devices!`);
      console.error('Available devices are:');
      inputs.forEach((device, i) => console.error(`  ${i+1}. "${device}"`));
      
      // Try to use the first available device instead
      if (inputs.length > 0) {
        console.log(`Falling back to first available device: "${inputs[0]}"`);
        this.input = new easymidi.Input(inputs[0]);
      } else {
        throw new Error('No MIDI devices available');
      }
    } else {
      console.log(`Found matching MIDI device: "${deviceName}"`);
      this.input = new easymidi.Input(deviceName);
    }
    
    // Listen for all MIDI messages
    this.input.on('noteon', async (msg) => {
      const noteName = this.getNoteNameFromNumber(msg.note);
      console.log(`MIDI Note: ${msg.note} (${noteName}), Velocity: ${msg.velocity}, Channel: ${msg.channel + 1}`);
      
      // Check if this is our trigger note
      const channelMatch = !this.config.channel || msg.channel === (this.config.channel - 1);
      if (msg.note === this.config.noteNumber && channelMatch) {
        console.log(`🎹 TRIGGER ACTIVATED! Note ${msg.note} (${noteName}) matches configured trigger`);
        this.callback?.();
      }
    });

    // Also listen for noteoff events to have complete information
    this.input.on('noteoff', (msg) => {
      const noteName = this.getNoteNameFromNumber(msg.note);
      console.log(`MIDI Note OFF: ${msg.note} (${noteName}), Channel: ${msg.channel + 1}`);
    });

    console.log(`Listening on MIDI device: ${deviceName}`);
    console.log(`Waiting for MIDI note ${this.config.noteNumber} (${this.getNoteNameFromNumber(this.config.noteNumber)}) to trigger mint`);
  }

  stop() {
    if (this.input) {
      this.input.close();
      this.input = null;
    }
  }

  onTrigger(callback: () => Promise<void>) {
    this.callback = callback;
  }
} 