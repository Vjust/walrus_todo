# Blockchain Todo Workflow

This guide demonstrates how to use the Walrus Todo CLI with blockchain integration for a complete workflow.

## Prerequisites

1. Install the Sui CLI and set up your wallet:
   ```bash
   # Install Sui CLI (if not already installed)
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui
   
   # Create a new wallet or import an existing one
   sui client new-address ed25519
   
   # Add some testnet SUI tokens from the faucet
   sui client faucet
   ```

2. Make sure your wallet has sufficient SUI tokens for gas fees

## Step 1: Deploy the Todo NFT Smart Contract

First, deploy the Todo NFT smart contract to the Sui blockchain:

```bash
# Deploy to testnet using your active Sui CLI wallet
waltodo deploy --network testnet
```

This will:
- Create a new Move package with the Todo NFT smart contract
- Publish it to the Sui blockchain
- Save the deployment information to `todo_nft_deployment.json`

Take note of the package ID that is displayed and saved to the deployment file. You'll need it for subsequent commands.

## Step 2: Create a Todo with Blockchain Integration

Create a new todo that will be stored on Walrus with an NFT reference on Sui:

```bash
# Create a todo with the deployed module address
waltodo store --title "Complete blockchain integration" \
              --description "Implement Walrus storage and Sui NFT references" \
              --network testnet \
              --module-address <PACKAGE_ID_FROM_STEP_1>
```

The command will:
- Create a todo object
- Store the todo data on Walrus decentralized storage
- Create an NFT on Sui that references the Walrus blob ID
- Return both the Walrus blob ID and Sui transaction digest

## Step 3: Retrieve Your Todo

Now retrieve the todo you just created:

```bash
# Option 1: Retrieve all todos owned by your wallet
waltodo retrieve --all --network testnet

# Option 2: Retrieve a specific todo by its NFT ID
waltodo retrieve --id <NFT_OBJECT_ID> --network testnet
```

This will:
- Fetch the NFT data from Sui
- Retrieve the todo content from Walrus using the blob ID stored in the NFT
- Display the complete todo information

## Step 4: Complete the Todo

Mark your todo as completed:

```bash
waltodo complete-blockchain --id <NFT_OBJECT_ID> --network testnet
```

This will:
- Fetch the NFT data from Sui
- Retrieve the current todo from Walrus
- Update the todo status to completed
- Store the updated todo back in Walrus
- Update the NFT status on Sui

## Step 5: Verify the Completed Todo

Verify that your todo is now marked as completed:

```bash
waltodo retrieve --id <NFT_OBJECT_ID> --network testnet
```

You should see that the todo now shows a completed status with a completion timestamp.

## Technical Details

This workflow demonstrates the hybrid storage model:
- **Walrus**: Stores the complete todo data (title, description, status, timestamps, etc.)
- **Sui Blockchain**: Stores an NFT with a reference to the Walrus blob ID

The benefits of this approach:
1. Efficient storage: Walrus handles the data storage more efficiently than on-chain storage
2. Ownership verification: Sui NFTs provide cryptographic proof of ownership
3. Transferability: You can transfer todo NFTs to delegate tasks
4. On-chain verification: Completed status is verified on the blockchain

## Troubleshooting

If you encounter issues:
1. Check that your Sui CLI is properly configured and has an active address
2. Verify you have sufficient SUI tokens for gas fees
3. Ensure you're using the correct module address from your deployment
4. Make sure the NFT object ID is correct when retrieving or completing todos