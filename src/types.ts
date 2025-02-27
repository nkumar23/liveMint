import { MidiTriggerConfig } from './triggers/MidiTriggerListener';
import { KeyboardTriggerConfig } from './triggers/KeyboardTriggerListener';
import { FootPedalConfig } from './triggers/FootPedalTriggerListener';
import { IftttTriggerConfig } from './triggers/IftttTriggerListener';

export enum TriggerType {
  MIDI = 'midi',
  KEYBOARD = 'keyboard',
  FOOT_PEDAL = 'footpedal',
  IFTTT = 'ifttt'
}

export interface NftMetadata {
  name: string;
  symbol: string;
  description: string;
  mediaFile: string;
  attributes?: {
    [key: string]: string | number | boolean;
  };
}

export interface TriggerMapping {
  id: string;
  type: TriggerType;
  config: MidiTriggerConfig | KeyboardTriggerConfig | FootPedalConfig | IftttTriggerConfig;
  nftMetadata: NftMetadata;
}

export interface MinterConfig {
  // Solana configuration
  rpcEndpoint: string;
  artistWallet: string;
  
  // Global NFT configuration
  maxSupply: number | null; // null for unlimited
  
  // Trigger mappings
  triggerMappings: TriggerMapping[];
} 