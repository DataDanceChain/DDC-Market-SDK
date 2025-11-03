# DDC Market SDK

a SDK that is TypeScript Compatible NPM for DDC Market Contract integration

## Design Idea

Reference to [DDC Market Contracts](https://github.com/DataDanceChain/DDC-Market-Contracts), Empowering any Dapp that intent to integrate DDC Market SDK to realize quick business growth.

## Architecture

Below is an architecture map for DDC Market SDK integration in a Dapp:

```mermaid
flowchart TD
    subgraph "B2B Business Layer"
        A[Business Dapp Website]
        B[DDC Market SDK]
        C{Choose Management API}
    end

    subgraph "SDK Management APIs"
        D[DDCNFT Management API]
        E[Membership Management API]
    end

    subgraph "Blockchain Layer"
        F[DDC Market Contracts]
    end

    subgraph "Data Collection & Display"
        G[DDC Market Backend Service]
        H[DDC Explore Service]
    end

    subgraph "B2C Consumer Layer"
        I[End User]
        J[User Wallet]
        K[Token Redemption]
        L[Membership Verification]
    end

    %% B2B Business Flow
    A -->|Imports| B
    B -->|Call SDK| C
    C -->|DDCNFT| D
    C -->|Membership| E

    %% SDK Management APIs to Blockchain
    D -->|Deploy & Manage DDCNFT| F
    E -->|Deploy & Manage Membership| F
    D -.->|SDK encapsulates| F
    E -.->|SDK encapsulates| F

    %% Data Collection (Independent)
    D -->|Send DDCNFT info| G
    E -->|Send Membership info| G
    F -->|On-chain data| G
    G -->|Aggregated data| H

    %% B2C Consumer Operations (Independent)
    F -->|Transfer tokens| J
    I -->|Redeem tokens| K
    K -->|Call contract| F
    F -->|Process rewards| I

    %% Membership Verification
    E -->|Verify| L
    L -->|Check status| F
    F -->|Return result| E

    %% Display to Consumer
    H -->|Show info| I

    %% Styling
    classDef businessClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef apiClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef contractClass fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef dataClass fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef consumerClass fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class A,B,C businessClass
    class D,E apiClass
    class F contractClass
    class G,H dataClass
    class I,J,K,L consumerClass

```

**Legend:**

**B2B Business Layer:**

- Business Dapp integrates SDK via NPM
- Business calls SDK to choose management type (DDCNFT or Membership)

**SDK Management APIs:**

- **DDCNFT Management API** & **Membership Management API**: SDK-provided peer-level management interfaces
- Both APIs are at the same level, providing different management functionalities
- Both encapsulate the underlying Blockchain Layer

**Blockchain Layer:**

- **DDC Market Contracts**: Blockchain contract layer
- Encapsulated and called by upper-layer Management APIs
- Handles all actual on-chain operations

**Data Collection & Display (Independent):**

- **DDC Market Backend Service**: Independently collects data from SDK and contracts
- **DDC Explore Service**: Independently displays aggregated information
- Relatively independent from B2B and B2C scenarios, responsible for data collection and display

**B2C Consumer Layer (Independent):**

- **End User**: C-end users as system consumers
- **User Wallet**: User wallet for receiving and storing tokens
- **Token Redemption**: Users redeem tokens to obtain rewards
- **Membership Verification**: B2B side verifies user membership status
- C-end scenario is relatively independent from B2B scenario, both are system users

# Design Requirements

- 作为 Web3 Dapp 的通用库, 需要支持 Browser 和 Node 环境下, 用户使用自己的钱包(Provider), 通过调用 DDC-Market SDK, 实现跟 DDC 合约的交互

- DDC SDK 不仅支持 DDC Layer2 的链上交互, 还提供了 DDC 中心化服务, 帮助用户配置和存储相关信息 用户可以读取和设置相关信息

## Installation

`pnpm install`

## Build SDK

`pnpm build:dev`

## Usage & Examples

- Browser EVM Wallets and [MetaMask Embedded Wallets (formerly Web3Auth)](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/)

- See /demo folder

## local demo

`pnpm demo:dev`
