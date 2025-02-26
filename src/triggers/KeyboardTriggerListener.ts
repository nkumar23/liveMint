import * as readline from 'readline';
import { KeyboardTriggerConfig } from '../types';
import { TriggerListener } from './TriggerListener';

export class KeyboardTriggerListener implements TriggerListener {
  private config: KeyboardTriggerConfig;
  private callback: (() => Promise<void>) | null = null;
  private active: boolean = false;

  constructor(config: KeyboardTriggerConfig) {
    this.config = config;
  }

  async start() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    this.active = true;
    
    console.log(`Listening for keyboard trigger: Press '${this.config.key}'${
      this.config.modifiers?.shift ? ' + Shift' : ''}${
      this.config.modifiers?.ctrl ? ' + Ctrl' : ''}${
      this.config.modifiers?.alt ? ' + Alt' : ''} to mint`);

    process.stdin.on('keypress', async (str, key) => {
      if (!this.active) return;
      
      // Check for Ctrl+C to exit
      if (key.ctrl && key.name === 'c') {
        process.exit();
      }

      // Check if the pressed key matches the configuration
      const keyMatches = key.name === this.config.key;
      const shiftMatches = !this.config.modifiers?.shift || key.shift;
      const ctrlMatches = !this.config.modifiers?.ctrl || key.ctrl;
      const altMatches = !this.config.modifiers?.alt || key.meta;

      if (keyMatches && shiftMatches && ctrlMatches && altMatches) {
        console.log('Keyboard trigger activated!');
        this.callback?.();
      }
    });
  }

  stop() {
    this.active = false;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  onTrigger(callback: () => Promise<void>) {
    this.callback = callback;
  }
} 