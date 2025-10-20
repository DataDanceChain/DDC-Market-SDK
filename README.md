# DDC Market SDK

a SDK that is TypeScript Compatible NPM for DDC Market Contract integration

## Design Idea

Reference to [DDC Market Contracts](https://github.com/DataDanceChain/DDC-Market-Contracts), Empowering any Dapp that intent to integrate DDC Market SDK to realize quick business growth.

## Architecture

Below is an architecture map for DDC Market SDK integration in a Dapp:

```mermaid
flowchart TD
    A[Business Dapp Website]
    B[DDC Market SDK (imported via NPM)]
    C[User]
    D[Metadata Input Modal (SDK)]
    E[DDC Market Backend Service<br/>(API)]
    F[DDC Market Contracts<br/>(ERC-721)]
    G[NFT Tokens]
    H[User Wallet]
    I[DDC Explore Service]

    A -->|Imports| B
    C -->|Interacts with| D
    B -->|Displays modal for metadata| D
    D -->|Sends metadata| E
    B -->|Calls contracts| F
    F -->|Mints NFT token| G
    G -->|Airdropped/Transferred| H
    H -->|User can redeem token| A
    F -->|On-chain NFT Data| I
    E -->|Off-chain Metadata| I
    I -->|Displays NFT info (addresses hidden, hashed only)| C
```

**Legend:**

- The Dapp integrates the SDK via NPM.
- Users interact with SDK modals for metadata entry.
- Metadata is sent to the DDC Market backend via API.
- The SDK calls on-chain DDC Market Contracts to mint NFTs.
- NFTs are distributed to users (via transfer or airdrop).
- DDC Explore Service aggregates and displays all info (on-chain/off-chain), with token addresses hidden (hashed).

## Installation

## Usage & Examples
