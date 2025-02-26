export type TriggerType = 'midi' | 'keyboard' | 'footpedal';

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
  config: MidiTriggerConfig | KeyboardTriggerConfig | FootPedalConfig;
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

export interface MidiTriggerConfig {
  noteNumber: number;
  deviceName?: string;
  channel?: number;
}

export interface KeyboardTriggerConfig {
  key: string;
  modifiers?: {
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
  };
}

export interface FootPedalConfig {
  usbDevice: string;
} 