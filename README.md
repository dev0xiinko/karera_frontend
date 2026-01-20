# Karera DS Frontend

A React-based frontend for testing the Karera DS smart contract.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Polkadot.js Browser Extension** - Install from [polkadot.js.org/extension](https://polkadot.js.org/extension/)
3. **A running Substrate node** with contracts pallet (e.g., `substrate-contracts-node`)

## Setup

### 1. Build the Smart Contract

First, build the smart contract to generate the metadata:

```bash
cd ..
cargo contract build
```

### 2. Copy the Contract Metadata

After building, copy the generated metadata to the frontend:

```bash
cp ../target/ink/karera_ds.json ./src/metadata.json
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Deploying the Contract

### Option 1: Using Contracts UI

1. Go to [Contracts UI](https://contracts-ui.substrate.io/)
2. Connect to your local node (ws://127.0.0.1:9944)
3. Upload the `.contract` file from `target/ink/karera_ds.contract`
4. Deploy and copy the contract address

### Option 2: Using cargo-contract

```bash
cd ..
cargo contract instantiate --constructor new --suri //Alice
```

Copy the contract address from the output.

## Using the Frontend

1. **Connect Wallet** - Click to connect your Polkadot.js extension
2. **Connect to Node** - Enter your node's WebSocket URL (default: ws://127.0.0.1:9944)
3. **Enter Contract Address** - Paste the deployed contract address
4. **Connect to Contract** - Initialize the contract connection
5. **Test Functions** - Use the various sections to test getters and setters

## Features

- **Status**: Get/Set race status (0=pending, 1=started, 2=finished)
- **Horses**: View all horses, add new horses
- **Bets**: View all bets, place new bets (payable)
- **Winners**: Get/Set race winners
- **Winning Combinations**: View/Add winning combinations
- **Rewards**: View/Add rewards

## Running a Local Node

If you don't have a node running:

```bash
# Install substrate-contracts-node
cargo install contracts-node

# Run the node
substrate-contracts-node --dev
```

## Troubleshooting

### "No wallet extension found"
Install the Polkadot.js browser extension from [polkadot.js.org/extension](https://polkadot.js.org/extension/)

### "Contract not found"
Make sure:
1. The contract is deployed to the connected node
2. The contract address is correct
3. The metadata.json matches the deployed contract

### Gas estimation failed
The contract might have reverted. Check:
1. You have sufficient balance
2. The contract state allows the operation
3. The parameters are valid
