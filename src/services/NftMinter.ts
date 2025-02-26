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
import { TriggerManager } from './TriggerManager';

export class NftMinter {
  private umi: any;
  private wallet: any;
  private config: MinterConfig;
  private mintCounts: Map<string, number> = new Map();
  private triggerManager: TriggerManager;

  constructor(config: MinterConfig) {
    this.config = config;
    
    // Initialize Umi
    this.umi = createUmi(config.rpcEndpoint)
      .use(irysUploader())
      .use(mplTokenMetadata());
    
    // Load wallet
    const homeDir = os.homedir();
    const walletPath = config.artistWallet.replace('~', homeDir);
    const keypairFile = fs.readFileSync(walletPath, 'utf-8');
    const keypairData = JSON.parse(keypairFile);
    this.wallet = this.umi.eddsa.createKeypairFromSecretKey(new Uint8Array(keypairData));
    this.umi.use(keypairIdentity(this.wallet));
    
    // Initialize trigger manager
    this.triggerManager = new TriggerManager(this);
    
    // Initialize mint counts for each trigger
    for (const mapping of config.triggerMappings) {
      this.mintCounts.set(mapping.id, 0);
    }
  }

  async mintNft(triggerId: string, timestamp: Date): Promise<any> {
    const triggerMapping = this.config.triggerMappings.find(m => m.id === triggerId);
    if (!triggerMapping) {
      throw new Error(`Trigger mapping not found for ID: ${triggerId}`);
    }
    
    try {
      const currentCount = this.mintCounts.get(triggerId) || 0;
      
      // Check max supply if set
      if (this.config.maxSupply !== null && currentCount >= this.config.maxSupply) {
        console.log(`Max supply reached for trigger ${triggerId}`);
        return null;
      }
      
      // Prepare metadata with timestamp
      const metadata = this.prepareMetadata(triggerMapping.nftMetadata, currentCount + 1, timestamp);
      
      // Upload image
      const imageBuffer = fs.readFileSync(triggerMapping.nftMetadata.mediaFile);
      const imageFile = createGenericFile(imageBuffer, 'image.jpg');
      
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
      console.log('View on Explorer:', `https://explorer.solana.com/address/${mint.publicKey}?cluster=devnet`);

      return {
        mint: mint.publicKey,
        transaction: tx,
        metadata: nftMetadata,
        timestamp: timestamp.toISOString(),
        triggerId
      };

    } catch (error) {
      console.error(`Error minting NFT for trigger ${triggerId}:`, error);
      throw error;
    }
  }
  
  private prepareMetadata(baseMetadata: NftMetadata, count: number, timestamp: Date): NftMetadata {
    // Create a deep copy to avoid modifying the original
    const metadata = JSON.parse(JSON.stringify(baseMetadata));
    
    // Add count to name if needed
    if (metadata.name.includes('{count}')) {
      metadata.name = metadata.name.replace('{count}', count.toString());
    }
    
    // Add timestamp to description if needed
    if (metadata.description.includes('{timestamp}')) {
      metadata.description = metadata.description.replace(
        '{timestamp}', 
        timestamp.toISOString()
      );
    }
    
    // Initialize attributes if not present
    if (!metadata.attributes) {
      metadata.attributes = {};
    }
    
    // Add timestamp attribute
    metadata.attributes.timestamp = timestamp.toISOString();
    metadata.attributes.mint_number = count;
    
    return metadata;
  }

  async startListening() {
    await this.triggerManager.startAllTriggers();
    console.log('All triggers initialized and listening');
  }
} 