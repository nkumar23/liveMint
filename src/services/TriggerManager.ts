import { MinterConfig, TriggerMapping, TriggerType } from '../types';
import { MidiTriggerListener, MidiTriggerConfig } from '../triggers/MidiTriggerListener';
import { KeyboardTriggerListener, KeyboardTriggerConfig } from '../triggers/KeyboardTriggerListener';
import { FootPedalTriggerListener, FootPedalConfig } from '../triggers/FootPedalTriggerListener';
import { IftttTriggerListener, IftttTriggerConfig } from '../triggers/IftttTriggerListener';
import { TriggerListener } from '../triggers/TriggerListener';
import { NftMinter } from './NftMinter';
import express from 'express';

export class TriggerManager {
  private config: MinterConfig;
  private minter: NftMinter;
  private listeners: Map<string, TriggerListener> = new Map();
  private app: express.Application;

  constructor(config: MinterConfig, minter: NftMinter, app: express.Application) {
    this.config = config;
    this.minter = minter;
    this.app = app;
  }

  async initializeTriggers(): Promise<void> {
    for (const mapping of this.config.triggerMappings) {
      await this.initializeTrigger(mapping);
    }
    console.log('All triggers initialized and listening');
  }

  private async initializeTrigger(mapping: TriggerMapping): Promise<void> {
    const callback = async (timestamp: Date) => {
      console.log(`Trigger ${mapping.id} activated at ${timestamp.toISOString()}`);
      try {
        await this.minter.mintNft(mapping.id, timestamp);
      } catch (error) {
        console.error(`Error minting NFT for trigger ${mapping.id}:`, error);
      }
    };

    let listener: TriggerListener;

    switch (mapping.type) {
      case TriggerType.MIDI:
        listener = new MidiTriggerListener(mapping.config as MidiTriggerConfig, callback);
        break;
      case TriggerType.KEYBOARD:
        listener = new KeyboardTriggerListener(mapping.config as KeyboardTriggerConfig, callback);
        break;
      case TriggerType.FOOT_PEDAL:
        listener = new FootPedalTriggerListener(mapping.config as FootPedalConfig, callback);
        break;
      case TriggerType.IFTTT:
        listener = new IftttTriggerListener(mapping.config as IftttTriggerConfig, callback, this.app);
        break;
      default:
        throw new Error(`Unsupported trigger type: ${mapping.type}`);
    }

    await listener.start();
    this.listeners.set(mapping.id, listener);
    console.log(`Trigger ${mapping.id} (${mapping.type}) started`);
  }

  async stopAllTriggers(): Promise<void> {
    for (const [id, listener] of this.listeners.entries()) {
      await listener.stop();
      console.log(`Trigger ${id} stopped`);
    }
    this.listeners.clear();
  }
  
  getIftttWebhookUrl(triggerId: string): string | null {
    const listener = this.listeners.get(triggerId);
    if (listener && listener instanceof IftttTriggerListener) {
      return (listener as IftttTriggerListener).getWebhookUrl();
    }
    return null;
  }
} 