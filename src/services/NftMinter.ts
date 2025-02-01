import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createGenericFile,
  generateSigner,
  percentAmount,
  keypairIdentity,
  sol,
} from "@metaplex-foundation/umi";
import { 
  TokenStandard,
  createV1,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { MinterConfig, KeyboardTriggerConfig, MidiTriggerConfig } from '../types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { MidiTrigger } from './MidiTrigger';

export class NftMinter {
  private umi: any;
  private wallet: any;
  private config: MinterConfig;
  private mintCount: number = 0;
  private midiTrigger: MidiTrigger | null = null;

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
  }

  async mintNft() {
    try {
      // Upload image
      const imageBuffer = fs.readFileSync(this.config.mediaFile);
      const imageFile = createGenericFile(imageBuffer, 'image.jpg');
      
      console.log('Uploading image...');
      const [imageUri] = await this.umi.uploader.upload([imageFile]);
      console.log('Image uploaded:', imageUri);

      // Create metadata
      const metadata = {
        name: `${this.config.name} #${this.mintCount + 1}`,
        symbol: this.config.symbol,
        description: this.config.description,
        image: imageUri,
      };

      // Upload metadata
      console.log('Uploading metadata...');
      const metadataUri = await this.umi.uploader.uploadJson(metadata);
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

      this.mintCount++;

      console.log('\nNFT Created Successfully!');
      console.log('Mint Address:', mint.publicKey);
      console.log('Owner Address:', this.wallet.publicKey);
      console.log('View on Explorer:', `https://explorer.solana.com/address/${mint.publicKey}?cluster=devnet`);

      return {
        mint: mint.publicKey,
        transaction: tx,
      };

    } catch (error) {
      console.error('Error minting NFT:', error);
      throw error;
    }
  }

  async startListening() {
    if (this.config.triggerType === 'midi') {
      this.midiTrigger = new MidiTrigger();
      await this.midiTrigger.listen(
        this.config.triggerConfig as MidiTriggerConfig,
        async () => {
          await this.mintNft();
          return;
        }
      );
    } else if (this.config.triggerType === 'keyboard') {
      await this.setupKeyboardTrigger(this.config.triggerConfig as KeyboardTriggerConfig);
    }
  }

  private async setupKeyboardTrigger(config: KeyboardTriggerConfig) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    console.log(`Listening for keyboard trigger: Press '${config.key}' to mint`);

    process.stdin.on('keypress', async (str, key) => {
      // Check for Ctrl+C to exit
      if (key.ctrl && key.name === 'c') {
        process.exit();
      }

      // Check if the pressed key matches
      if (key.name === config.key) {
        console.log('Keyboard trigger activated!');
        await this.mintNft();
      }
    });
  }
} 