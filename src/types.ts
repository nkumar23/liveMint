export type TriggerType = 'midi' | 'keyboard';

export interface MinterConfig {
  // Solana configuration
  rpcEndpoint: string;
  artistWallet: string;
  
  // NFT configuration
  name: string;
  symbol: string;
  description: string;
  mediaFile: string;
  maxSupply: number | null; // null for unlimited

  // Trigger configuration
  triggerType: TriggerType;
  triggerConfig: MidiTriggerConfig | KeyboardTriggerConfig;
}

export interface MidiTriggerConfig {
  noteNumber: number;
  deviceName?: string;
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