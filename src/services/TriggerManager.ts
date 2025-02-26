import { MinterConfig, TriggerMapping, TriggerType } from '../types';
import { MidiTriggerListener } from '../triggers/MidiTriggerListener';
import { KeyboardTriggerListener } from '../triggers/KeyboardTriggerListener';
import { FootPedalTriggerListener } from '../triggers/FootPedalTriggerListener';
import { TriggerListener } from '../triggers/TriggerListener';
import { NftMinter } from './NftMinter';

export class TriggerManager {
  private triggers: Map<string, TriggerListener> = new Map();
  private minter: NftMinter;

  constructor(minter: NftMinter) {
    this.minter = minter;
  }

  async startAllTriggers() {
    const config = (this.minter as any).config as MinterConfig;
    
    for (const mapping of config.triggerMappings) {
      const trigger = this.createTriggerListener(mapping);
      
      if (trigger) {
        trigger.onTrigger(async () => {
          const timestamp = new Date();
          console.log(`Trigger ${mapping.id} activated at ${timestamp.toISOString()}`);
          await this.minter.mintNft(mapping.id, timestamp);
        });
        
        await trigger.start();
        this.triggers.set(mapping.id, trigger);
        console.log(`Trigger ${mapping.id} (${mapping.type}) started`);
      }
    }
  }
  
  private createTriggerListener(mapping: TriggerMapping): TriggerListener | null {
    switch (mapping.type) {
      case 'midi':
        return new MidiTriggerListener(mapping.config as any);
      case 'keyboard':
        return new KeyboardTriggerListener(mapping.config as any);
      case 'footpedal':
        return new FootPedalTriggerListener(mapping.config as any);
      default:
        console.error(`Unknown trigger type: ${mapping.type}`);
        return null;
    }
  }
  
  stopAllTriggers() {
    for (const [id, trigger] of this.triggers.entries()) {
      trigger.stop();
      console.log(`Trigger ${id} stopped`);
    }
    this.triggers.clear();
  }
} 