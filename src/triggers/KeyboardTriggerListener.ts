import { TriggerListener } from './TriggerListener';
import * as readline from 'readline';

// Make sure keypress is properly imported
let keypress: any;
try {
  keypress = require('keypress');
} catch (error) {
  console.error('Keypress module not found. Install it with: npm install keypress');
}

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
  private stdin: any = null;
  private listener: any = null;

  constructor(config: KeyboardTriggerConfig, callback: (timestamp: Date) => void) {
    this.config = config;
    this.callback = callback;
    console.log(`KeyboardTriggerListener created with key: "${config.key}"`);
  }

  async start(): Promise<void> {
    if (!keypress) {
      console.error('Keypress module not available. Keyboard trigger will not work.');
      return;
    }

    this.active = true;
    
    // Use stdin as the input stream
    this.stdin = process.stdin;
    
    // Check if stdin is a TTY
    if (!this.stdin.isTTY) {
      console.error('stdin is not a TTY. Keyboard trigger will not work.');
      return;
    }
    
    // Make stdin a raw device
    try {
      this.stdin.setRawMode(true);
    } catch (error) {
      console.error('Error setting raw mode:', error);
      console.log('Keyboard trigger may not work correctly. Try running with sudo or as administrator.');
    }
    
    // Resume the stdin stream
    this.stdin.resume();
    
    // Set the encoding to utf8
    this.stdin.setEncoding('utf8');
    
    // Make stdin emit keypress events
    keypress(this.stdin);
    
    console.log(`Listening for keyboard key: "${this.config.key}" (charCode: ${this.config.key.charCodeAt(0)})`);
    
    // Define the keypress handler
    this.listener = (ch: string, key: any) => {
      // Log all keypresses for debugging
      console.log('Key pressed:', key ? JSON.stringify(key) : 'undefined', 'Char:', ch);
      
      if (!this.active) return;
      
      // Exit on Ctrl+C
      if (key && key.ctrl && key.name === 'c') {
        process.exit();
      }
      
      // Check if this is the key we're looking for (try both key name and character)
      if ((key && key.name === this.config.key.toLowerCase()) || 
          (ch && ch === this.config.key)) {
        // Check modifiers if specified
        if (this.config.modifiers) {
          if (this.config.modifiers.shift && !key.shift) return;
          if (this.config.modifiers.ctrl && !key.ctrl) return;
          if (this.config.modifiers.alt && !key.alt) return;
        }
        
        console.log(`Keyboard key ${this.config.key} pressed - TRIGGERING CALLBACK`);
        this.callback(new Date());
      }
    };
    
    // Register the keypress handler
    this.stdin.on('keypress', this.listener);
    
    console.log('Keyboard listener started');
  }

  async stop(): Promise<void> {
    this.active = false;
    
    // Unregister keyboard listeners
    if (this.stdin && this.listener) {
      this.stdin.removeListener('keypress', this.listener);
      
      // Reset stdin to its normal mode
      this.stdin.setRawMode(false);
      this.stdin.pause();
    }
    
    console.log('Keyboard listener stopped');
    return Promise.resolve();
  }
} 