import { FootPedalConfig } from '../types';
import { TriggerListener } from './TriggerListener';

export class FootPedalTriggerListener implements TriggerListener {
  private config: FootPedalConfig;
  private callback: (() => Promise<void>) | null = null;
  
  constructor(config: FootPedalConfig) {
    this.config = config;
  }

  async start() {
    console.log(`Foot pedal trigger initialized for device: ${this.config.usbDevice}`);
    // Implementation would depend on the specific foot pedal hardware
    // This is a placeholder for future implementation
  }

  stop() {
    // Cleanup code for foot pedal
  }

  onTrigger(callback: () => Promise<void>) {
    this.callback = callback;
  }
} 