import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createGenericFile,
  generateSigner,
  percentAmount,
  signerIdentity,
  keypairIdentity,
  sol,
} from "@metaplex-foundation/umi";
import { 
  TokenStandard,
  createV1,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import * as fs from "fs";
import { config as loadEnv } from 'dotenv';
import * as os from 'os';

loadEnv();

async function testMint() {
  // Check if test image exists
  if (!fs.existsSync('./assets/test-image.jpg')) {
    console.error('Test image not found at ./assets/test-image.jpg');
    return;
  }

  console.log('Starting NFT mint test...');

  // Initialize Umi
  const umi = createUmi('https://api.devnet.solana.com')
    .use(irysUploader());

  // Load existing wallet instead of generating new one
  const homeDir = os.homedir();
  const walletPath = process.env.ARTIST_WALLET!.replace('~', homeDir);
  const keypairFile = fs.readFileSync(walletPath, 'utf-8');
  const keypairData = JSON.parse(keypairFile);
  // Create keypair from secret key bytes
  const wallet = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(keypairData));
  
  umi.use(keypairIdentity(wallet));
  console.log('Using wallet:', wallet.publicKey);

  try {
    // Upload image
    const imageBuffer = fs.readFileSync('./assets/test-image.jpg');
    const imageFile = createGenericFile(imageBuffer, 'image.jpg');
    
    console.log('Uploading image...');
    const [imageUri] = await umi.uploader.upload([imageFile]);
    console.log('Image uploaded:', imageUri);

    // Create metadata
    const metadata = {
      name: "Test NFT",
      symbol: "TEST",
      description: "A test NFT",
      image: imageUri,
    };

    // Upload metadata
    console.log('Uploading metadata...');
    const metadataUri = await umi.uploader.uploadJson(metadata);
    console.log('Metadata uploaded:', metadataUri);

    // Create NFT
    console.log('Minting NFT...');
    const mint = generateSigner(umi);
    const tx = await createV1(umi, {
      mint,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      tokenStandard: TokenStandard.NonFungible,
    }).sendAndConfirm(umi);

    console.log('\nNFT Created Successfully!');
    console.log('Mint Address:', mint.publicKey);
    console.log('Owner Address:', wallet.publicKey);
    console.log('View on Explorer:', `https://explorer.solana.com/address/${mint.publicKey}?cluster=devnet`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testMint().catch(console.error); 