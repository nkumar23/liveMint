import { createProgrammableNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  createGenericFile,
  generateSigner,
  percentAmount,
  signerIdentity,
  sol,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { base58 } from "@metaplex-foundation/umi/serializers";
import * as fs from "fs";
import * as path from "path";

async function testStorage() {
  // Initialize Umi with Irys uploader for devnet
  const umi = createUmi('https://api.devnet.solana.com')
    .use(mplTokenMetadata())
    .use(
      irysUploader({
        address: "https://devnet.irys.xyz",
      })
    );

  // Generate a new test signer
  const signer = generateSigner(umi);
  umi.use(signerIdentity(signer));

  // Airdrop some SOL for testing
  console.log("Airdropping 1 SOL to test wallet...");
  await umi.rpc.airdrop(umi.identity.publicKey, sol(1));

  try {
    // Read and prepare the image file
    const imageBuffer = fs.readFileSync('./assets/test-image.jpg');
    const imageFile = createGenericFile(imageBuffer, "test-image.jpg", {
      tags: [{ name: "Content-Type", value: "image/jpeg" }],
    });

    // Upload image to Arweave via Irys
    console.log("Uploading image to Arweave...");
    const imageUri = await umi.uploader.upload([imageFile]);
    console.log("Image uploaded:", imageUri[0]);

    // Prepare and upload metadata
    const metadata = {
      name: "Test NFT",
      description: "A test NFT upload",
      image: imageUri[0],
      attributes: [
        {
          trait_type: "test",
          value: "test value"
        }
      ],
      properties: {
        files: [
          {
            uri: imageUri[0],
            type: "image/jpeg"
          }
        ],
        category: "image"
      }
    };

    console.log("Uploading metadata...");
    const metadataUri = await umi.uploader.uploadJson(metadata);
    console.log("Metadata uploaded:", metadataUri);

    // Create the NFT
    const nftSigner = generateSigner(umi);
    console.log("Creating NFT...");
    const tx = await createProgrammableNft(umi, {
      mint: nftSigner,
      name: metadata.name,
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(5.5),
    }).sendAndConfirm(umi);

    const signature = base58.deserialize(tx.signature)[0];
    console.log("\nNFT Created Successfully!");
    console.log("Transaction:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log("NFT Address:", `https://explorer.solana.com/address/${nftSigner.publicKey}?cluster=devnet`);

  } catch (error) {
    console.error("Error:", error);
  }
}

testStorage().catch(console.error); 