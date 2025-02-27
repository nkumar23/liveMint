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

  async initialize() {
    // Additional initialization code would go here
  }

  async mintNft(triggerId: string, timestamp: Date = new Date()): Promise<string> {
    try {
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
      if (mediaFilePath.startsWith('/assets/')) {
        // Convert from web path to filesystem path
        mediaFilePath = path.join(__dirname, '../../', mediaFilePath.substring(1));
      }
      
      // Read the media file
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

  async startListening() {
    await this.triggerManager.startAllTriggers();
    console.log('All triggers initialized and listening');
  }
} 