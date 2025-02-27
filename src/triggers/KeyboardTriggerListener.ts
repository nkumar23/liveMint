import { TriggerListener } from './TriggerListener';

export interface KeyboardTriggerConfig {
  key: string;
  modifiers?: {
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
  };
}

export class KeyboardTriggerListener implements TriggerListener {
  private config: KeyboardTriggerConfig;
  private callback: (timestamp: Date) => void;
  private active: boolean = false;
  private keyHandler: any = null;

  constructor(config: KeyboardTriggerConfig, callback: (timestamp: Date) => void) {
    this.config = config;
    this.callback = callback;
  }

  async start(): Promise<void> {
    this.active = true;
    
    // This is a placeholder - in a real app, you'd use a proper keyboard library
    console.log(`Listening for keyboard key: ${this.config.key}`);
    
    // Mock implementation for demo purposes
    this.keyHandler = (event: any) => {
      if (!this.active) return;
      
      if (event.key.toLowerCase() === this.config.key.toLowerCase()) {
        // Check modifiers if specified
        if (this.config.modifiers) {
          if (this.config.modifiers.shift && !event.shiftKey) return;
          if (this.config.modifiers.ctrl && !event.ctrlKey) return;
          if (this.config.modifiers.alt && !event.altKey) return;
        }
        
        console.log(`Keyboard key ${this.config.key} pressed`);
        this.callback(new Date());
      }
    };
    
    // In a browser environment, you'd use:
    // document.addEventListener('keydown', this.keyHandler);
    
    // For Node.js, you'd need a library like 'keypress' or similar
  }

  async stop(): Promise<void> {
    this.active = false;
    
    // In a browser:
    // document.removeEventListener('keydown', this.keyHandler);
    
    console.log('Keyboard listener stopped');
  }
} 