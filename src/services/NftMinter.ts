import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createGenericFile,
  generateSigner,
  percentAmount,
  keypairIdentity,
} from "@metaplex-foundation/umi";
import { 
  TokenStandard,
  createV1,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { MinterConfig, NftMetadata, TriggerMapping } from '../types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import { Keypair } from '@solana/web3.js';

export class NftMinter {
  private config: MinterConfig;
  private umi: any;
  private wallet: any;
  private mintCounts: Map<string, number> = new Map();
  private app: express.Application | null = null;

  constructor(config: MinterConfig) {
    this.config = config;
  }

  async initialize() {
    try {
      console.log('Initializing NFT minter...');
      
      // Check if we're on mainnet
      const isMainnet = process.env.NETWORK === 'mainnet';
      if (isMainnet) {
        console.log('⚠️ RUNNING IN MAINNET MODE - REAL TRANSACTIONS WILL BE MADE ⚠️');
      } else {
        console.log('Running in DEVNET mode - no real transactions will be made');
      }
      
      // Initialize Umi with network-specific settings
      this.umi = createUmi(this.config.rpcEndpoint)
        .use(irysUploader({
          address: isMainnet ? 'https://node1.irys.xyz' : 'https://devnet.irys.xyz',
          timeout: isMainnet ? 120000 : 60000
        }))
        .use(mplTokenMetadata());
      
      // Load wallet with extra safeguards for mainnet
      try {
        console.log(`Loading wallet from: ${this.config.artistWallet}`);
        const walletPath = this.config.artistWallet.startsWith('~') 
          ? this.config.artistWallet.replace('~', os.homedir())
          : this.config.artistWallet;
        
        const keypairFile = fs.readFileSync(walletPath, 'utf-8');
        const keypairData = JSON.parse(keypairFile);
        
        // Create a UMI keypair instead of a Solana web3.js keypair
        this.wallet = this.umi.eddsa.createKeypairFromSecretKey(new Uint8Array(keypairData));
        this.umi.use(keypairIdentity(this.wallet));
        
        console.log('Wallet loaded successfully');
        
        // Check wallet balance using UMI
        const balance = await this.umi.rpc.getBalance(this.wallet.publicKey);
        const solBalance = Number(balance.basisPoints) / 1000000000;
        console.log(`Wallet balance: ${solBalance} SOL`);
        
        if (isMainnet && solBalance < 0.1) {
          console.warn('⚠️ WARNING: Wallet balance is low. You may not have enough SOL for minting NFTs.');
        }
      } catch (error) {
        console.error('Error loading wallet:', error);
        throw new Error('Failed to load wallet');
      }
      
      // Initialize mint counts for each trigger
      for (const mapping of this.config.triggerMappings) {
        this.mintCounts.set(mapping.id, 0);
      }
      
      console.log('NFT minter initialized successfully');
    } catch (error) {
      console.error('Error initializing NFT minter:', error);
      throw error;
    }
  }

  // Helper method to derive public key from secret key
  private derivePublicKey(secretKey: Uint8Array): Uint8Array {
    try {
      // This is a simplified version - in a real app, you'd use the proper crypto library
      // For now, we'll just return the last 32 bytes of the secret key as a placeholder
      return secretKey.slice(32, 64);
    } catch (error) {
      console.error('Error deriving public key:', error);
      throw error;
    }
  }

  async mintNft(triggerId: string, timestamp: Date = new Date()): Promise<string> {
    try {
      if (process.env.NETWORK !== 'mainnet') {
        console.warn('⚠️ WARNING: Not running in mainnet mode. This transaction will be on devnet.');
      }

      // Check if we're connected to the expected network
      try {
        const genesisHash = await this.umi.rpc.getGenesisHash();
        const isMainnet = genesisHash === '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
        
        if (process.env.NETWORK === 'mainnet' && !isMainnet) {
          console.error('ERROR: Expected to be on mainnet but connected to a different network');
          throw new Error('Network mismatch - expected mainnet');
        } else if (process.env.NETWORK !== 'mainnet' && isMainnet) {
          console.error('ERROR: Expected to be on devnet but connected to mainnet');
          throw new Error('Network mismatch - unexpected mainnet connection');
        }
        
        console.log(`Confirmed on ${isMainnet ? 'mainnet' : 'devnet'}`);
      } catch (error: any) {
        if (error.message?.includes('Network mismatch')) {
          throw error;
        }
        console.warn('Could not verify network:', error);
      }

      // Find the trigger mapping
      const mapping = this.config.triggerMappings.find(m => m.id === triggerId);
      if (!mapping) {
        throw new Error(`Trigger mapping not found for ID: ${triggerId}`);
      }

      // Get the current count for this trigger
      const currentCount = this.mintCounts.get(triggerId) || 0;
      
      // Check max supply if set
      if (this.config.maxSupply !== null && currentCount >= this.config.maxSupply) {
        console.log(`Max supply reached for trigger ${triggerId}`);
        return "Max supply reached";
      }

      // Get the metadata for this NFT
      const metadata = { ...mapping.nftMetadata };
      
      // Replace placeholders in metadata
      metadata.name = metadata.name.replace('{count}', (currentCount + 1).toString());
      metadata.description = metadata.description.replace('{timestamp}', timestamp.toISOString());
      
      // Fix the file path - if it starts with a slash and doesn't have the full project path
      let mediaFilePath = metadata.mediaFile;
      if (mediaFilePath.startsWith('./')) {
        // Convert from relative path to absolute path
        mediaFilePath = path.join(process.cwd(), mediaFilePath.substring(2));
      } else if (!path.isAbsolute(mediaFilePath)) {
        // If it's not absolute and doesn't start with ./, assume it's relative to project root
        mediaFilePath = path.join(process.cwd(), mediaFilePath);
      }
      
      console.log(`Loading media file from: ${mediaFilePath}`);
      
      // Add debugging information
      console.log('Current working directory:', process.cwd());
      try {
        const dirPath = path.dirname(mediaFilePath);
        if (fs.existsSync(dirPath)) {
          console.log(`Files in ${dirPath}:`, fs.readdirSync(dirPath));
        } else {
          console.log(`Directory does not exist: ${dirPath}`);
        }
      } catch (error) {
        console.error('Error listing directory:', error);
      }
      
      // Check if the file exists
      if (!fs.existsSync(mediaFilePath)) {
        throw new Error(`Media file not found: ${mediaFilePath}`);
      }
      
      const mediaData = fs.readFileSync(mediaFilePath);
      
      // Upload image
      const imageFile = createGenericFile(mediaData, path.basename(mediaFilePath));
      
      console.log(`Uploading image for trigger ${triggerId}...`);
      const [imageUri] = await this.umi.uploader.upload([imageFile]);
      console.log('Image uploaded:', imageUri);

      // Create full metadata
      const nftMetadata = {
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
        image: imageUri,
        attributes: Object.entries(metadata.attributes || {}).map(([trait_type, value]) => ({
          trait_type,
          value
        })),
      };
      
      // Upload metadata
      console.log('Uploading metadata...');
      const metadataUri = await this.umi.uploader.uploadJson(nftMetadata);
      console.log('Metadata uploaded:', metadataUri);

      // Check wallet balance before minting
      console.log('Checking wallet balance before minting...');
      const balance = await this.umi.rpc.getBalance(this.wallet.publicKey);
      const solBalance = Number(balance.basisPoints) / 1000000000;
      console.log(`Current wallet balance: ${solBalance} SOL`);
      console.log(`Wallet public key: ${this.wallet.publicKey}`);

      if (solBalance < 0.05) {
        console.error('Insufficient funds for minting. Please add more SOL to your wallet.');
        throw new Error('Insufficient funds for minting');
      }

      // Create NFT
      console.log('Minting NFT...');
      const mint = generateSigner(this.umi);
      const tx = await createV1(this.umi, {
        mint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0),
        tokenStandard: TokenStandard.NonFungible,
      }).sendAndConfirm(this.umi);

      // Increment mint count for this trigger
      this.mintCounts.set(triggerId, currentCount + 1);

      console.log('\nNFT Created Successfully!');
      console.log('Mint Address:', mint.publicKey);
      console.log('Owner Address:', this.wallet.publicKey);
      console.log('View on Explorer:', `https://explorer.solana.com/address/${mint.publicKey}`);

      return mint.publicKey.toString();
    } catch (error) {
      console.error(`Error minting NFT for trigger ${triggerId}:`, error);
      throw error;
    }
  }
  
  private prepareMetadata(metadata: NftMetadata, count: number, timestamp: Date): NftMetadata {
    const result = { ...metadata };
    result.name = result.name.replace('{count}', count.toString());
    result.description = result.description.replace('{timestamp}', timestamp.toISOString());
    return result;
  }
} 