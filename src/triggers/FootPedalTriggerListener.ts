import { TriggerListener } from './TriggerListener';

export interface FootPedalConfig {
  usbDevice: string;
}

export class FootPedalTriggerListener implements TriggerListener {
  private config: FootPedalConfig;
  private callback: (timestamp: Date) => void;
  private active: boolean = false;
  private device: any = null;

  constructor(config: FootPedalConfig, callback: (timestamp: Date) => void) {
    this.config = config;
    this.callback = callback;
  }

  async start(): Promise<void> {
    this.active = true;
    console.log(`Listening for foot pedal on device: ${this.config.usbDevice}`);
    
    // This is a placeholder - in a real app, you'd use a USB HID library
    // to connect to the foot pedal device
  }

  async stop(): Promise<void> {
    this.active = false;
    console.log('Foot pedal listener stopped');
    // Clean up any resources
    if (this.device) {
      this.device.close();
    }
    return Promise.resolve();
  }
} 